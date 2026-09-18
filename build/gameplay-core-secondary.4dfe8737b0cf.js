
/* bundled source: js/40-v144-rules-and-abyss.js */
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
                return "我方全體異常狀態抗性 +65%、命中 +50%，持續3回合";
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
                return '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);"><span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.1</span><span style="flex:1;">我方全體異常狀態抗性 +65%、命中 +50%，持續3回合</span></div>';
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
        if(monster.v132FixedSkillLoadout){
            const forcedLevel=Math.max(1,Math.floor(numeric(monster.v141ForceSkillLevel)||1));
            monster.v144LegalSkillPool=(monster.skillIds||[]).slice();
            monster.v141SkillLevel=forcedLevel;
            monster.v144SkillLevel=forcedLevel;
            monster.v144SkillEncounter=encounterId||("fixed-"+(++encounterSequence));
            return monster;
        }
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
        東帝天尊:{element:"earth",skills:["dustStorm","stoneBreakSky"],supports:["barrier"]},
        天帝天尊:{element:"wind",skills:["windHowlLightning","stormRain","stormSpell"],supports:[]},
        極帝天尊:{element:"light",skills:[],supports:["yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"]},
        北帝天尊:{element:"water",skills:["iceArrowRain","freeze"],supports:["healSpell"]},
        南帝天尊:{element:"fire",skills:["phoenixCry","dragonSlash"],supports:["rage"]}
    };
    const FINAL_ELITES=[
        {element:"water",skills:[],supports:["healSpell"]},
        {element:"earth",skills:["stoneBreakSky"],supports:[]},
        {element:"fire",skills:["phoenixCry"],supports:[]},
        {element:"wind",skills:[],supports:["dodgeSkill"]},
        {element:"water",skills:[],supports:["healSpell"]}
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
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=4;
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
        const entries=abyssAllies().filter(entry=>entry.monster&&entry.monster.alive);
        const living=typeof window.v141GetMonsterAllyTriTargets==="function"
            ?window.v141GetMonsterAllyTriTargets(monsterIndex,entries)
            :entries.slice(0,3);
        const skillId=living.some(entry=>{
            const ally=entry.monster;
            const shield=ally.v141Shield;
            const hp=shield?numeric(ally.hp)-numeric(shield.remaining):numeric(ally.hp);
            const max=shield?numeric(shield.baseMaxHP):numeric(ally.maxHP);
            return hp<max||numeric(ally.sp)<numeric(ally.maxSP);
        })?"healSpell":null;
        if(!skillId||Math.random()>.55||!spendAndBadge(monster,monsterIndex,skillId)){ return false; }
        const skill=skillDatabase.healSpell;
        const level=Math.max(1,numeric(skill.maxLevel)||1);
        const hpAmount=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(level-1);
        const spAmount=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(level-1);
        let hpTotal=0,spTotal=0;
        living.forEach(entry=>{
            const ally=entry.monster;
            const healed=typeof window.v141HealMonsterPreservingShield==="function"
                ?window.v141HealMonsterPreservingShield(ally,hpAmount):0;
            hpTotal+=healed;
            const before=numeric(ally.sp);
            ally.sp=Math.min(numeric(ally.maxSP),before+spAmount);
            const restoredSp=ally.sp-before;
            spTotal+=restoredSp;
            if(skill.cleanseAll&&Array.isArray(ally.statusEffects)){ ally.statusEffects=[]; }
            if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
            if(restoredSp>0&&typeof showDamagePopup==="function"){
                const card=document.getElementById("battleMonster"+entry.index);
                if(card){ showDamagePopup(card,"+"+restoredSp+" SP","sp"); }
            }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
        });
        addBattleLog("北帝天尊施放最高等級治療術：同排最多"+living.length+"名友方共回復"+
            hpTotal+" HP、"+spTotal+" SP。");
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


/* bundled source: js/41-v146-system-polish.js */
/* =====================================================
   V146 — final mobile polish for combat, Abyss, inventory,
   home roster, shop totals, synthesis and elemental sets.
===================================================== */
(function installV146SystemPolish(){
    "use strict";

    if(typeof window==="undefined"||window.__v146SystemPolishInstalled){ return; }
    window.__v146SystemPolishInstalled=true;

    const VERSION="146";

    function numeric(value){
        const number=Number(value);
        return Number.isFinite(number)?number:0;
    }

    function formatHomeResourceValue(value){
        const whole=Math.max(0,Math.floor(numeric(value)));
        if(whole>=100000000){
            const compact=whole/100000000;
            const precision=compact>=10?1:2;
            return compact.toFixed(precision).replace(/\.?0+$/g,"")+"億";
        }
        if(whole>=10000){ return Math.floor(whole/10000)+"萬"; }
        return whole.toLocaleString("zh-TW");
    }

    function syncHomeResourceValue(node,value){
        if(!node){ return; }
        const whole=Math.max(0,Math.floor(numeric(value)));
        const full=whole.toLocaleString("zh-TW");
        node.textContent=formatHomeResourceValue(whole);
        node.title=full;
        node.setAttribute("aria-label",full);
    }

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }

    /* ----- Shop quantity always exposes the real total cost. ----- */
    window.v146UpdateShopTotal=function(itemId){
        const input=document.getElementById("shopQuantity-"+itemId);
        const output=document.getElementById("shopTotal-"+itemId);
        if(!input||!output){ return 0; }
        const quantity=Math.max(1,Math.min(9999,Math.floor(numeric(input.value)||1)));
        const unitPrice=Math.max(0,Math.floor(numeric(input.dataset.unitPrice)));
        const total=quantity*unitPrice;
        output.textContent=total.toLocaleString("zh-TW")+" 金幣";
        output.dataset.total=String(total);
        const button=input.parentElement&&input.parentElement.querySelector(".shop-potion-buy");
        if(button){ button.disabled=numeric(typeof gold!=="undefined"?gold:0)<total; }
        return total;
    };

    function syncShopTotals(){
        document.querySelectorAll(".shop-potion-quantity[id^='shopQuantity-']").forEach(input=>{
            window.v146UpdateShopTotal(input.id.replace("shopQuantity-",""));
        });
    }

    /* ----- Element sets: exact piece stats, role variant and restrictions. ----- */
    const SET_ELEMENTS={setFire:"fire",setWater:"water",setEarth:"earth",setWind:"wind"};
    const SET_LABELS={setFire:"赤炎",setWater:"寒泉",setEarth:"岩岳",setWind:"青嵐"};
    const PIECE_RULES={
        blade:{role:"attack",roleLabel:"攻",name:"刀",stats:{attack:10,vitality:-2}},
        fan:{role:"magic",roleLabel:"法",name:"扇",stats:{intelligence:10,vitality:-2}},
        heavyArmor:{role:"attack",roleLabel:"攻",name:"鎧甲",stats:{attack:5,spirit:5}},
        robe:{role:"magic",roleLabel:"法",name:"袍",stats:{intelligence:5,spirit:5}},
        boots:{role:"attack",roleLabel:"攻",name:"靴",stats:{attack:2,agility:10}},
        shoes:{role:"magic",roleLabel:"法",name:"履",stats:{intelligence:2,agility:10}},
        helm:{role:"attack",roleLabel:"攻",name:"盔",stats:{attack:12}},
        crown:{role:"magic",roleLabel:"法",name:"冠",stats:{intelligence:12}},
        wristguard:{role:"attack",roleLabel:"攻",name:"護腕",stats:{attack:12}},
        focus:{role:"magic",roleLabel:"法",name:"法環",stats:{intelligence:12}}
    };

    function pieceKey(item){
        const id=String(item&&item.id||"");
        return Object.keys(PIECE_RULES).find(key=>id.endsWith("_"+key))||null;
    }

    function applySetRule(item){
        if(!item||!SET_ELEMENTS[item.setId]){ return item; }
        const key=pieceKey(item);
        const rule=key&&PIECE_RULES[key];
        if(!rule){ return item; }
        item.name=SET_LABELS[item.setId]+rule.name+"["+rule.roleLabel+"]";
        item.stats=Object.assign({},rule.stats);
        item.levelRequirement=20;
        item.requiredElement=SET_ELEMENTS[item.setId];
        item.setVariant=rule.role;
        return item;
    }

    function allOwnedItems(){
        const items=[];
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            inventoryItems.forEach(item=>items.push(item));
        }
        if(typeof characterEquipment!=="undefined"&&characterEquipment){
            Object.values(characterEquipment).forEach(slots=>
                Object.values(slots||{}).forEach(item=>{ if(item){ items.push(item); } })
            );
        }
        return items;
    }

    function syncSetDefinitions(){
        const content=typeof window.v132GetContentDefinitions==="function"
            ?window.v132GetContentDefinitions():null;
        const definitions=content&&content.equipmentSetItems||[];
        const definitionById=new Map(definitions.map(item=>[item.id,item]));
        definitions.forEach(applySetRule);
        allOwnedItems().forEach(item=>{
            const definition=definitionById.get(item&&item.id);
            if(definition){ item.icon=definition.icon; }
            applySetRule(item);
        });
    }

    function variantCountsForEquipment(equipmentKey,setId){
        const counts={attack:0,magic:0};
        const equipment=typeof characterEquipment!=="undefined"&&characterEquipment
            ?characterEquipment[equipmentKey]:null;
        Object.values(equipment||{}).forEach(item=>{
            if(item&&item.setId===setId&&counts[item.setVariant]!==undefined){ counts[item.setVariant]++; }
        });
        return counts;
    }

    if(typeof getEquipmentBonus==="function"){
        const previousEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=previousEquipmentBonus.apply(this,arguments);
            Object.keys(SET_ELEMENTS).forEach(setId=>{
                const counts=variantCountsForEquipment(characterId,setId);
                const total=counts.attack+counts.magic;
                if(total>=3&&counts.attack<3&&counts.magic<3){
                    ["attack","vitality","energy","intelligence","spirit","agility"].forEach(stat=>{
                        bonus[stat]=(numeric(bonus[stat])-1);
                    });
                }
            });
            return bonus;
        };
    }

    if(typeof getElementDamagePassiveMultiplier==="function"){
        const previousElementMultiplier=getElementDamagePassiveMultiplier;
        getElementDamagePassiveMultiplier=function(character){
            let multiplier=previousElementMultiplier.apply(this,arguments);
            const characterKey=typeof getCharacterSkillKey==="function"?getCharacterSkillKey(character):null;
            const equipmentKey=characterKey||null;
            const setId=Object.keys(SET_ELEMENTS).find(id=>SET_ELEMENTS[id]===character?.element);
            if(equipmentKey&&setId){
                const counts=variantCountsForEquipment(equipmentKey,setId);
                const total=counts.attack+counts.magic;
                if(total>=5&&counts.attack<5&&counts.magic<5){ multiplier-=.02; }
            }
            return multiplier;
        };
    }

    if(typeof equipSelectedItem==="function"){
        const previousEquipSelectedItem=equipSelectedItem;
        equipSelectedItem=function(){
            const item=typeof inventorySlots!=="undefined"&&selectedInventorySlot!==null
                ?inventorySlots[selectedInventorySlot]:null;
            const character=typeof getBackpackCharacter==="function"
                ?getBackpackCharacter(inventoryCharacterIndex):null;
            if(item&&item.requiredElement&&character&&character.element!==item.requiredElement){
                const elementName=typeof elementDatabase!=="undefined"&&elementDatabase[item.requiredElement]
                    ?elementDatabase[item.requiredElement].name:item.requiredElement;
                alert(item.name+"僅限"+elementName+"元素角色穿戴。");
                return;
            }
            return previousEquipSelectedItem.apply(this,arguments);
        };
    }

    function syncSetModal(item){
        if(!item||!item.setId||!item.setVariant){ return; }
        const equipmentKey=typeof getBackpackEquipmentKey==="function"
            ?getBackpackEquipmentKey(inventoryCharacterIndex):null;
        const counts=variantCountsForEquipment(equipmentKey,item.setId);
        const count=counts[item.setVariant]||0;
        const role=item.setVariant==="attack"?"攻":"法";
        const title=document.querySelector("#itemModalStats .v132-set-title");
        const bonuses=document.querySelectorAll("#itemModalStats .v132-set-bonus");
        if(title){ title.textContent="["+SET_LABELS[item.setId]+"•"+role+"] "+count+"/5"; }
        if(bonuses[0]){
            bonuses[0].classList.toggle("active",count>=3);
            bonuses[0].classList.toggle("inactive",count<3);
            bonuses[0].textContent="裝備三件　全能力+1　["+(count>=3?"已啟動":"未啟動")+"]";
        }
        if(bonuses[1]){
            bonuses[1].classList.toggle("active",count>=5);
            bonuses[1].classList.toggle("inactive",count<5);
            const elementName=typeof elementDatabase!=="undefined"&&elementDatabase[item.requiredElement]
                ?elementDatabase[item.requiredElement].name:"";
            bonuses[1].textContent="裝備五件　"+elementName+"元素技能傷害+2%　["+(count>=5?"已啟動":"未啟動")+"]";
        }
    }

    if(typeof openItemModal==="function"){
        const previousOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=previousOpenItemModal.apply(this,arguments);
            syncSetModal(typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null);
            return result;
        };
    }
    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            const result=previousOpenEquippedItem.apply(this,arguments);
            syncSetModal(item);
            return result;
        };
    }

    /* ----- Enabling auto outside combat immediately performs configured recovery. ----- */
    if(typeof toggleAutoBattle==="function"){
        const previousToggleAutoBattle=toggleAutoBattle;
        toggleAutoBattle=function(){
            const result=previousToggleAutoBattle.apply(this,arguments);
            if(
                typeof battleActive!=="undefined"&&!battleActive&&
                typeof autoBattle!=="undefined"&&autoBattle&&
                typeof applyPostBattleAutoRecovery==="function"
            ){
                applyPostBattleAutoRecovery();
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
            }
            return result;
        };
    }

    /* ----- First successful abnormal-status application gets a named popup. ----- */
    const STATUS_LABELS={
        burn:"燃燒",freeze:"冰封",petrify:"石化",agilityDown:"重力",
        defenseDown:"防禦降低",statDown:"全屬性降低",damageDown:"殤風",
        stun:"暈眩"
    };

    function locateEntity(entity){
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            const index=monsters.indexOf(entity);
            if(index>=0){ return {side:"monster",index:index}; }
        }
        if(typeof getPartyCharacterIndex==="function"){
            const index=getPartyCharacterIndex(entity);
            if(index>=0){ return {side:"player",index:index}; }
        }
        return null;
    }

    function hasActiveStatus(entity,type){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type===type&&numeric(effect.turnsLeft)>0
        ));
    }

    function statusHitDelay(location){
        const current=window.v143SkillAnimationState&&window.v143SkillAnimationState.current;
        if(!current||current.done||current.targetSide!==location.side){ return 30; }
        const position=Math.max(0,current.targetIndexes.indexOf(location.index));
        const stagger=current.model&&current.model.sprite
            ?0
            :(current.targetIndexes.length>1?Math.min(210,position*55):0);
        const hitAt=Math.min(
            current.startedAt+current.duration-140,
            current.startedAt+current.duration*numeric(current.model&&current.model.hit)+stagger
        );
        return Math.max(30,hitAt-Date.now()+115);
    }

    function showStatusPopup(entity,type){
        const label=STATUS_LABELS[type];
        const location=locateEntity(entity);
        if(!label||!location||typeof document==="undefined"){ return; }
        setTimeout(()=>{
            const card=document.getElementById(location.side==="monster"
                ?"battleMonster"+location.index:"battlePlayerCard"+location.index);
            if(!card||card.offsetParent===null){ return; }
            const rect=card.getBoundingClientRect();
            const popup=document.createElement("strong");
            popup.className="v146-status-popup status-"+type;
            popup.textContent=label;
            popup.style.left=(rect.left+rect.width/2)+"px";
            popup.style.top=(rect.top+rect.height*.86)+"px";
            document.body.appendChild(popup);
            setTimeout(()=>popup.remove(),1300);
        },statusHitDelay(location));
    }

    function wrapSimpleStatus(functionName,type){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(entity){
            const activeBefore=hasActiveStatus(entity,type);
            const result=previous.apply(this,arguments);
            if(!activeBefore&&hasActiveStatus(entity,type)){ showStatusPopup(entity,type); }
            return result;
        };
    }
    wrapSimpleStatus("applyBurnEffect","burn");
    wrapSimpleStatus("applyFreezeEffect","freeze");

    if(typeof applyMonsterDebuff==="function"){
        const previousApplyMonsterDebuff=applyMonsterDebuff;
        applyMonsterDebuff=function(monster,type){
            const activeBefore=hasActiveStatus(monster,type);
            const result=previousApplyMonsterDebuff.apply(this,arguments);
            if(!activeBefore&&hasActiveStatus(monster,type)){ showStatusPopup(monster,type); }
            return result;
        };
    }

    function syncDefeatedCards(){
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach((monster,index)=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.toggle("v146-defeated",!monster||monster.alive===false||numeric(monster.hp)<=0); }
            });
        }
        if(typeof getPartyCharacterByIndex==="function"){
            [0,1,2].forEach(index=>{
                const character=getPartyCharacterByIndex(index);
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){ card.classList.toggle("v146-defeated",!character||numeric(character.hp)<=0); }
            });
        }
    }

    /* ----- Abyss is a real walk-up map: bounded steps, movement lock, proximity. ----- */
    let abyssMoveUnlockTimer=0;

    function percentagePosition(element,property,fallback){
        const value=parseFloat(element&&element.style&&element.style[property]);
        return Number.isFinite(value)?value:fallback;
    }

    if(typeof window.v141AbyssMoveByEvent==="function"){
        const previousAbyssMove=window.v141AbyssMoveByEvent;
        window.v141AbyssMoveByEvent=function(event){
            const map=document.getElementById("v141AbyssMap");
            const playerElement=document.getElementById("v141AbyssPlayer");
            if(!map||!playerElement){ return previousAbyssMove.apply(this,arguments); }
            const boss=map.querySelector(".v141-abyss-boss");
            const bossRect=boss&&boss.getBoundingClientRect?boss.getBoundingClientRect():null;
            const pointX=Number(event&&event.clientX);
            const pointY=Number(event&&event.clientY);
            const target=event&&event.target;
            const bossHit=!!(boss&&(
                (target&&target.closest&&target.closest(".v141-abyss-boss")===boss)||
                (bossRect&&Number.isFinite(pointX)&&Number.isFinite(pointY)&&
                    pointX>=bossRect.left&&pointX<=bossRect.right&&
                    pointY>=bossRect.top&&pointY<=bossRect.bottom)
            ));
            if(bossHit){ return previousAbyssMove.apply(this,arguments); }
            if(map.dataset.v146Moving==="1"){ return; }
            if(event&&event.target&&event.target.closest&&event.target.closest("button")){ return; }
            const rect=map.getBoundingClientRect();
            const currentX=percentagePosition(playerElement,"left",18);
            const currentY=percentagePosition(playerElement,"top",78);
            const desiredX=Math.max(4,Math.min(96,(numeric(event.clientX)-rect.left)/rect.width*100));
            const desiredY=Math.max(8,Math.min(94,(numeric(event.clientY)-rect.top)/rect.height*100));
            const dx=desiredX-currentX;
            const dy=desiredY-currentY;
            const distance=Math.hypot(dx,dy);
            if(distance<.8){ return; }
            const maxStep=24;
            const ratio=Math.min(1,maxStep/distance);
            const targetX=currentX+dx*ratio;
            const targetY=currentY+dy*ratio;
            const duration=Math.max(.45,Math.min(2.4,Math.hypot(targetX-currentX,targetY-currentY)/28));
            const synthetic={
                target:event.target,clientX:rect.left+targetX/100*rect.width,
                clientY:rect.top+targetY/100*rect.height
            };
            map.dataset.v146Moving="1";
            map.classList.add("v146-moving");
            clearTimeout(abyssMoveUnlockTimer);
            abyssMoveUnlockTimer=setTimeout(()=>{
                map.dataset.v146Moving="0";
                map.classList.remove("v146-moving");
            },duration*1000+90);
            return previousAbyssMove.call(this,synthetic);
        };
    }

    window.v146ExitAbyssMap=function(){
        if(typeof window.v174AbyssLeaveToGameplay==="function"){
            window.v174AbyssLeaveToGameplay();
        }else if(typeof showPage==="function"){
            showPage("gameplay");
        }
    };

    function syncDungeonShell(){
        const page=document.getElementById("dungeonPage");
        const app=document.getElementById("app");
        if(!page||!app){ return; }
        const active=page.classList.contains("active");
        const abyssMapActive=active&&!!page.querySelector(".v141-abyss-shell");
        const abyssSelectionActive=active&&!!page.querySelector(".v174-abyss-selection,.v174-abyss-complete");
        const abyssActive=abyssMapActive||abyssSelectionActive;
        page.classList.toggle("v146-abyss-active",abyssActive);
        page.classList.toggle("v146-abyss-intro-mode",active&&!!page.querySelector(".v141-abyss-intro"));
        const nav=document.getElementById("v141DungeonNav");
        if(nav){ nav.dataset.v146Columns="5"; }
        if(typeof window.v148SyncContextNavigation==="function"){
  window.v148SyncContextNavigation();
        }else if(typeof window.v148SyncDungeonShell==="function"){
  window.v148SyncDungeonShell();
        }
        const oldReturn=document.getElementById("v141DungeonReturn");
        if(oldReturn){ oldReturn.remove(); }
        let topReturn=document.getElementById("v146AbyssReturn");
        if(abyssMapActive&&!topReturn){
            topReturn=document.createElement("button");
            topReturn.id="v146AbyssReturn";
            topReturn.type="button";
            topReturn.className="v146-abyss-return";
            topReturn.setAttribute("aria-label","返回副本列表");
            topReturn.innerHTML='<img src="assets/ui/map-return.png" alt="">';
            topReturn.onclick=window.v146ExitAbyssMap;
            page.appendChild(topReturn);
        }else if(!abyssMapActive&&topReturn){ topReturn.remove(); }
    }

    if(typeof switchDungeonTab==="function"){
        const previousSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(tabName){
            const result=previousSwitchDungeonTab.apply(this,arguments);
            setTimeout(syncDungeonShell,0);
            return result;
        };
    }
    if(typeof window.v141StartAbyss==="function"){
        const previousStartAbyss=window.v141StartAbyss;
        window.v141StartAbyss=function(){
            const result=previousStartAbyss.apply(this,arguments);
            setTimeout(syncDungeonShell,0);
            return result;
        };
    }
    if(typeof window.v141ResetAbyss==="function"){
        const previousResetAbyss=window.v141ResetAbyss;
        window.v141ResetAbyss=function(){
            const result=previousResetAbyss.apply(this,arguments);
            setTimeout(syncDungeonShell,0);
            return result;
        };
    }

    /* Main-city roster is first-screen UI and is owned by the eager V54 city runtime. */
    function renderHomeRoster(){
        return typeof window.v54RenderHomeRoster==="function"?window.v54RenderHomeRoster():undefined;
    }

    /* ----- Progressive character growth guidance. ----- */
    const EQUIPPABLE_SKILL_CATEGORIES=new Set(["physical","magic","buff","heal","revive"]);

    function setCharacterAttentionDot(target,show,label){
        if(!target){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot");
        if(show&&!dot){
            dot=document.createElement("span");
            dot.className="v141-notice-dot";
            dot.setAttribute("aria-hidden","true");
            target.appendChild(dot);
        }else if(!show&&dot){
            dot.remove();
        }
        if(show){ target.title=label; }
        else if(target.title===label){ target.removeAttribute("title"); }
    }

    function setGrowthGuidanceDot(target,show,label){
        if(!target){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot.v146-growth-guidance-dot");
        if(show&&!dot){
            dot=document.createElement("span");
            dot.className="v141-notice-dot v146-growth-guidance-dot";
            dot.setAttribute("aria-hidden","true");
            target.appendChild(dot);
        }else if(!show&&dot){
            dot.remove();
        }
        if(show){
            target.classList.add("v146-growth-attention-target");
            if(typeof getComputedStyle==="function"){
                try{
                    if(getComputedStyle(target).position==="static"){ target.style.position="relative"; }
                }catch(_){ }
            }
            target.dataset.v146GrowthTitle=label||"有可處理內容";
            target.title=label||"有可處理內容";
        }else{
            target.classList.remove("v146-growth-attention-target");
            if(target.dataset&&target.dataset.v146GrowthTitle&&target.title===target.dataset.v146GrowthTitle){
                target.removeAttribute("title");
            }
            if(target.dataset){ delete target.dataset.v146GrowthTitle; }
        }
    }

    function characterKeyForIndex(index){
        if(typeof getPartyCharacterKey==="function"){
            const key=getPartyCharacterKey(index);
            if(key){ return key; }
        }
        return index===2?"player3":index===1?"player2":"fire";
    }

    function characterCanLevel(index){
        const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
        if(!character){ return false; }
        const maxLevel=Math.max(1,numeric(window.v133MaxLevel)||100);
        if(numeric(character.level)>=maxLevel){ return false; }
        const need=Math.max(1,numeric(character.expNext)-Math.max(0,numeric(character.exp)));
        const catchUp=typeof window.v173GetExpPoolCatchUpMultiplierForLevel==="function"
            ?Math.max(1,numeric(window.v173GetExpPoolCatchUpMultiplierForLevel(character.level))||1)
            :1;
        const poolCost=Math.max(1,Math.ceil(need/catchUp));
        const available=typeof window.v173GetAvailableExpPool==="function"
            ?numeric(window.v173GetAvailableExpPool(Date.now()))
            :numeric(typeof sharedExp!=="undefined"?sharedExp:0);
        return available>=poolCost;
    }

    function characterSkillAttention(index){
        const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
        const key=characterKeyForIndex(index);
        const loadout=typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts
            ?characterSkillLoadouts[key]:null;
        if(!character||!loadout||typeof skillDatabase==="undefined"||!skillDatabase){
            return {show:false,canSpend:false,canEquip:false};
        }
        const levels=loadout.skillLevels||{};
        const equipped=Array.isArray(loadout.equippedSkills)?loadout.equippedSkills:[];
        const points=Math.max(0,numeric(character.skillPoints));
        let canSpend=false;
        let canEquip=false;
        Object.keys(skillDatabase).forEach(skillId=>{
            const skill=skillDatabase[skillId];
            if(!skill||skill.element!==character.element){ return; }
            const level=Math.max(0,numeric(levels[skillId]));
            if(level<=0){
                const prereqMet=typeof isSkillPrereqMet==="function"
                    ?!!isSkillPrereqMet(levels,skill)
                    :(skill.requires||[]).every(requiredId=>numeric(levels[requiredId])>0);
                if(prereqMet&&points>=Math.max(0,numeric(skill.learnCost))){ canSpend=true; }
            }else if(level<Math.max(1,numeric(skill.maxLevel)||1)&&points>=1){
                canSpend=true;
            }
            if(
                level>0&&
                EQUIPPABLE_SKILL_CATEGORIES.has(skill.category)&&
                !equipped.includes(skillId)&&
                equipped.length<4
            ){
                canEquip=true;
            }
        });
        return {show:canSpend||canEquip,canSpend:canSpend,canEquip:canEquip};
    }

    function getCharacterGrowthAttention(){
        if(typeof getExistingPartyIndexes!=="function"){ return {show:false,label:"",byIndex:{}}; }
        let canLevel=false;
        let hasAttributePoints=false;
        let hasSkillAttention=false;
        const byIndex={};
        getExistingPartyIndexes().slice(0,3).forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            if(!character){ return; }
            const skill=characterSkillAttention(index);
            const item={
                canLevel:characterCanLevel(index),
                hasAttributePoints:numeric(character.attributePoints)>0,
                skill:skill
            };
            byIndex[index]=item;
            if(item.canLevel){ canLevel=true; }
            if(item.hasAttributePoints){ hasAttributePoints=true; }
            if(skill.show){ hasSkillAttention=true; }
        });
        const reasons=[];
        if(canLevel){ reasons.push("可升級"); }
        if(hasAttributePoints){ reasons.push("能力點未分配"); }
        if(hasSkillAttention){ reasons.push("技能可學習／升級／裝備"); }
        return {
            show:reasons.length>0,
            label:reasons.length?"角色："+reasons.join("、"):"",
            canLevel:canLevel,
            hasAttributePoints:hasAttributePoints,
            hasSkillAttention:hasSkillAttention,
            byIndex:byIndex
        };
    }

    function clearLegacyHudExpAttention(){
        const target=document.getElementById("homeHudExpValue")?.parentElement||null;
        if(!target){ return; }
        const dot=target.querySelector(":scope > .v141-notice-dot");
        if(dot){ dot.remove(); }
        if(target.title==="經驗池可讓角色升級"){ target.removeAttribute("title"); }
    }

    function guideCharacterAvatars(attention,type){
        Object.keys(attention.byIndex||{}).forEach(key=>{
            const index=Number(key);
            const item=attention.byIndex[key];
            const avatar=document.getElementById("characterAvatar"+index);
            const target=avatar&&avatar.parentElement?avatar.parentElement:avatar;
            const show=type==="expPool"
                ?item.canLevel
                :type==="status"
                ?item.hasAttributePoints
                :type==="skill"
                ?item.skill&&item.skill.show
                :false;
            const label=type==="expPool"?"這名角色可以升級":type==="status"?"這名角色有能力點未分配":"這名角色有技能可處理";
            setGrowthGuidanceDot(target,!!show,label);
        });
    }

    function guideExpPool(attention){
        guideCharacterAvatars(attention,"expPool");
        const container=document.getElementById("expDistributeList");
        if(!container){ return; }
        const indexes=typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes().slice(0,3):[];
        Array.from(container.querySelectorAll(".v131-exp-row")).forEach((row,position)=>{
            const index=indexes[position];
            const button=row.querySelector(".v131-exp-preview-btn");
            const show=index!==undefined&&!!attention.byIndex[index]&&attention.byIndex[index].canLevel&&button&&!button.disabled;
            setGrowthGuidanceDot(button,!!show,"點擊預覽升級");
        });
        const confirm=container.querySelector(".v131-exp-confirm");
        setGrowthGuidanceDot(confirm,!!(confirm&&!confirm.disabled),"確認本次升級");
    }

    function guideStatus(attention){
        guideCharacterAvatars(attention,"status");
        const page=document.getElementById("statusPage");
        if(!page){ return; }
        const index=typeof statusCharacterIndex!=="undefined"&&Number.isInteger(Number(statusCharacterIndex))
            ?Number(statusCharacterIndex):0;
        const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
        const used=typeof pendingStats!=="undefined"&&pendingStats
            ?Object.values(pendingStats).reduce((sum,value)=>sum+Math.max(0,numeric(value)),0):0;
        const remaining=Math.max(0,numeric(character&&character.attributePoints)-used);
        page.querySelectorAll("[onclick*='addPoint']").forEach(button=>{
            setGrowthGuidanceDot(button,remaining>0,"尚有能力點可分配");
        });
        const confirm=document.getElementById("confirmStatusButton");
        setGrowthGuidanceDot(confirm,!!(confirm&&used>0&&!confirm.disabled),"確認能力配點");
    }

    function skillIdFromRow(row){
        const icon=row&&row.querySelector?row.querySelector("[id^='skillIcon_']"):null;
        return icon?icon.id.slice("skillIcon_".length):"";
    }

    function guideSkills(attention){
        guideCharacterAvatars(attention,"skill");
        const page=document.getElementById("skillPage");
        if(!page||typeof currentSkillCharacter==="undefined"){ return; }
        const indexes=typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes().slice(0,3):[];
        const currentIndex=indexes.find(index=>characterKeyForIndex(index)===currentSkillCharacter);
        if(currentIndex===undefined){ return; }
        const character=getPartyCharacterByIndex(currentIndex);
        const loadout=typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts
            ?characterSkillLoadouts[currentSkillCharacter]:null;
        if(!character||!loadout||typeof skillDatabase==="undefined"){ return; }
        const levels=loadout.skillLevels||{};
        const equipped=Array.isArray(loadout.equippedSkills)?loadout.equippedSkills:[];
        const points=Math.max(0,numeric(character.skillPoints));
        let hasEquipReminder=false;

        page.querySelectorAll("#allSkillsList .skill-row").forEach(row=>{
            const skillId=skillIdFromRow(row);
            const skill=skillId&&skillDatabase[skillId];
            if(!skill){ return; }
            const level=Math.max(0,numeric(levels[skillId]));
            const actionCards=Array.from(row.querySelectorAll(".skill-action-card"));
            const growthCard=actionCards.find(card=>{
                const onclick=card.getAttribute("onclick")||"";
                return onclick.includes("learnSkill(")||onclick.includes("upgradeSkill(");
            });
            let canSpend=false;
            if(level<=0){
                const prereqMet=typeof isSkillPrereqMet==="function"
                    ?!!isSkillPrereqMet(levels,skill)
                    :(skill.requires||[]).every(requiredId=>numeric(levels[requiredId])>0);
                canSpend=prereqMet&&points>=Math.max(0,numeric(skill.learnCost));
            }else{
                canSpend=level<Math.max(1,numeric(skill.maxLevel)||1)&&points>=1;
            }
            setGrowthGuidanceDot(
                growthCard,
                !!(canSpend&&growthCard&&!growthCard.classList.contains("disabled")),
                level>0?"技能點足夠，可升級":"技能點足夠，可學習"
            );

            const equipCard=actionCards.find(card=>(card.getAttribute("onclick")||"").includes("equipSkill("));
            const canEquip=
                level>0&&
                EQUIPPABLE_SKILL_CATEGORIES.has(skill.category)&&
                !equipped.includes(skillId)&&
                equipped.length<4;
            setGrowthGuidanceDot(
                equipCard,
                !!(canEquip&&equipCard&&!equipCard.classList.contains("disabled")),
                "已學習但尚未裝備"
            );
            if(canEquip&&equipCard&&!equipCard.classList.contains("disabled")){ hasEquipReminder=true; }
        });

        const slots=Array.from(page.querySelectorAll("#skillLoadout .skill-loadout-slot"));
        const emptySlot=slots.find(slot=>!slot.querySelector("[id^='loadoutIcon_']"));
        slots.forEach(slot=>{
            setGrowthGuidanceDot(slot,!!(hasEquipReminder&&slot===emptySlot),"這個技能欄位可以裝備技能");
        });
    }

    function syncCharacterAttentionDots(){
        const attention=getCharacterGrowthAttention();
        const homeButton=document.getElementById("homeIconCharacter")?.parentElement||null;
        setCharacterAttentionDot(homeButton,attention.show,attention.label);
        document.querySelectorAll("#mapPageNav button[aria-label='角色']").forEach(button=>{
            setCharacterAttentionDot(button,attention.show,attention.label);
        });
        clearLegacyHudExpAttention();

        const modal=document.getElementById("homeFeatureModal");
        const tabContent=document.getElementById("characterTabContent");
        if(!modal||!tabContent||!modal.classList.contains("show")){ return; }

        setGrowthGuidanceDot(document.getElementById("characterTabBtnExpPool"),attention.canLevel,"有角色可以升級");
        setGrowthGuidanceDot(document.getElementById("characterTabBtnStatus"),attention.hasAttributePoints,"有能力點尚未分配");
        setGrowthGuidanceDot(document.getElementById("characterTabBtnSkill"),attention.hasSkillAttention,"有技能可以學習、升級或裝備");

        const expPage=document.getElementById("homeExpPoolCard");
        const statusPage=document.getElementById("statusPage");
        const skillPage=document.getElementById("skillPage");
        if(expPage&&tabContent.contains(expPage)){ guideExpPool(attention); }
        if(statusPage&&tabContent.contains(statusPage)){ guideStatus(attention); }
        if(skillPage&&tabContent.contains(skillPage)){ guideSkills(attention); }
    }
    window.v146SyncCharacterAttentionDots=syncCharacterAttentionDots;
    window.v146GetCharacterGrowthAttention=getCharacterGrowthAttention;

    /* ----- Synthesis blueprints and crafted results are ordinary equipment, never elemental sets. ----- */
    const SYNTHESIS_SET_PREFIX=/^(赤炎|寒泉|岩岳|青嵐)/;
    const SYNTHESIS_SET_COLORS=/#(?:e24b32|4bb9e8|c59a54|55cda3)/gi;

    function normalizeOrdinaryBlueprintItem(item){
        if(!item||!item.blueprintSlot){ return item; }
        item.name=String(item.name||"裝備設計圖").replace(SYNTHESIS_SET_PREFIX,"");
        delete item.setId;
        item.v146OrdinaryBlueprint=true;
        return item;
    }

    function normalizeOrdinaryCraftedItem(item){
        if(!item||!item.v141Crafted){ return item; }
        item.name=String(item.name||"普通裝備").replace(SYNTHESIS_SET_PREFIX,"");
        delete item.setId;
        delete item.requiredElement;
        delete item.setVariant;
        if(typeof item.icon==="string"){
            item.icon=item.icon.replace(SYNTHESIS_SET_COLORS,"#c59a54");
        }
        item.v146OrdinaryCrafted=true;
        return item;
    }

    function normalizeOrdinarySynthesisData(){
        const content=typeof window.v132GetContentDefinitions==="function"
            ?window.v132GetContentDefinitions():null;
        const definitions=content&&Array.isArray(content.blueprints)?content.blueprints:[];
        definitions.forEach(normalizeOrdinaryBlueprintItem);
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            inventoryItems.forEach(item=>{
                normalizeOrdinaryBlueprintItem(item);
                normalizeOrdinaryCraftedItem(item);
            });
        }
    }

    if(typeof window.v141CraftEquipment==="function"){
        const previousCraftEquipment=window.v141CraftEquipment;
        window.v141CraftEquipment=function(){
            const before=new Set(
                (typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)?inventoryItems:[])
                    .map(item=>item&&item.v141Uid).filter(Boolean)
            );
            const result=previousCraftEquipment.apply(this,arguments);
            let normalized=false;
            if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
                inventoryItems.forEach(item=>{
                    if(!item||!item.v141Crafted||before.has(item.v141Uid)){ return; }
                    normalizeOrdinaryCraftedItem(item);
                    normalized=true;
                });
            }
            if(normalized){
                if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
                if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
                if(typeof saveGame==="function"){ saveGame(); }
            }
            return result;
        };
    }

    /* ----- Synthesis step 2 is retired; equipment output is always ordinary. ----- */
    function polishSynthesis(){
        const root=document.querySelector(".v141-synthesis");
        if(!root){ return; }
        root.classList.add("v146-synthesis-ordinary");
        root.querySelectorAll(".v141-blueprint-series").forEach(node=>node.remove());
        root.querySelectorAll("label").forEach(label=>{
            if(/^\s*2[　\s]/.test(label.textContent||"")){ label.remove(); }
        });
        root.querySelectorAll(".v143-item-picker button").forEach(button=>{
            const span=button.querySelector("span");
            const original=button.getAttribute("aria-label")||span&&span.textContent||"設計圖";
            const cleaned=original.replace(SYNTHESIS_SET_PREFIX,"");
            button.setAttribute("aria-label",cleaned);
            button.title=cleaned;
            if(span){ span.remove(); }
        });
        const preview=root.querySelector(".v141-craft-preview div:last-child");
        if(preview){
            preview.innerHTML="<b>隨機普通裝備</b><span>合成只會產生一般普通裝備；四大套裝僅由戰鬥掉落或獎勵取得。</span>";
        }
    }

    if(typeof window.v141RenderSynthesis==="function"){
        const previousRenderSynthesis=window.v141RenderSynthesis;
        window.v141RenderSynthesis=function(){
            const result=previousRenderSynthesis.apply(this,arguments);
            polishSynthesis();
            return result;
        };
    }

    /* ----- Shared lifecycle. ----- */
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            if(page==="home"){ renderHomeRoster(); }
            if(page==="dungeon"){ setTimeout(syncDungeonShell,0); }
            setTimeout(syncDefeatedCards,0);
            setTimeout(syncCharacterAttentionDots,0);
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            renderHomeRoster();
            syncDefeatedCards();
            syncShopTotals();
            syncCharacterAttentionDots();
            return result;
        };
    }

    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncDefeatedCards();
            return result;
        };
    }

    if(typeof updateGoldDisplay==="function"){
        const previousUpdateGoldDisplay=updateGoldDisplay;
        updateGoldDisplay=function(){
            const result=previousUpdateGoldDisplay.apply(this,arguments);
            renderHomeRoster();
            syncShopTotals();
            syncCharacterAttentionDots();
            return result;
        };
    }

    let mutationQueued=false;
    function syncDynamicDom(){
        mutationQueued=false;
        syncShopTotals();
        syncDungeonShell();
        polishSynthesis();
        syncDefeatedCards();
        syncCharacterAttentionDots();
    }
    if(typeof MutationObserver!=="undefined"){
        const observer=new MutationObserver(()=>{
            if(mutationQueued){ return; }
            mutationQueued=true;
            requestAnimationFrame(syncDynamicDom);
        });
        const startObserver=()=>observer.observe(document.body,{childList:true,subtree:true});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",startObserver,{once:true}); }
        else{ startObserver(); }
    }

    normalizeOrdinarySynthesisData();
    syncSetDefinitions();
    const boot=()=>{
        renderHomeRoster(); syncDungeonShell(); syncShopTotals(); polishSynthesis(); syncDefeatedCards(); syncCharacterAttentionDots();
    };
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }
    else{ boot(); }

    window.v146Diagnostics=function(){
        return {
            version:VERSION,inventoryPageSize:18,shopTotals:true,abyssStepLimit:24,
            abyssProximity:20,setElementRestriction:true,ordinarySynthesisOnly:true
        };
    };
})();


/* bundled source: js/42-v148-combat-dungeon-fixes.js */
/* =====================================================
   V148 — combat target truth, support rules and dungeon usability
===================================================== */
(function installV148CombatDungeonFixes(){
    "use strict";

    if(typeof window==="undefined" || window.__v148CombatDungeonFixesInstalled){ return; }
    window.__v148CombatDungeonFixesInstalled=true;

    const VERSION="148";
    const HARD_CONTROL_TYPES=["freeze","petrify"];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function partyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>Number.isInteger(index));
        }
        return [0,1,2].filter(index=>
            typeof getPartyCharacterByIndex==="function"&&!!getPartyCharacterByIndex(index)
        );
    }

    function livingPartyIndexes(){
        return partyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return !!(character&&numeric(character.hp)>0);
        });
    }

    function activeBuff(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function activeStatus(entity,type){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type===type&&numeric(effect.turnsLeft)>0
        ));
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level))-1));
        return numeric(values[index]);
    }

    if(typeof window.v135GetSkillTargetScopeLabel==="function"){
        const previousScopeLabel=window.v135GetSkillTargetScopeLabel;
        window.v135GetSkillTargetScopeLabel=function(skill){
            if(skill&&skill.targetType==="allyTri"){ return "我方三人・同排左中右"; }
            return previousScopeLabel.apply(this,arguments);
        };
    }

    function battlefieldSlots(){
        return window.FourSymbolsBattlefieldSlots||null;
    }

    function monsterAlive(index){
        const monster=typeof monsters!=="undefined"?monsters[index]:null;
        return !!(monster&&monster.alive!==false&&numeric(monster.hp)>0);
    }

    function activeFormationSnapshot(indexes){
        const owner=battlefieldSlots();
        if(!owner){ return null; }
        let snapshot=owner.getActiveEnemySnapshot();
        if(!snapshot&&typeof window.v138EnsureEnemyFormationSnapshot==="function"){
            snapshot=window.v138EnsureEnemyFormationSnapshot(indexes||[]);
        }
        return snapshot;
    }

    function stableFormationRows(indexes){
        const owner=battlefieldSlots();
        const snapshot=activeFormationSnapshot(indexes);
        if(owner&&snapshot){ return owner.getAssignedEnemyRows(snapshot); }
        if(typeof window.v138GetFormationRows==="function"){
            const rows=window.v138GetFormationRows((indexes||[]).filter(Number.isInteger));
            if(Array.isArray(rows)){ return rows.filter(Array.isArray).map(row=>row.slice()); }
        }
        const ordered=(indexes||[]).filter(Number.isInteger);
        return ordered.length?[ordered]:[];
    }

    function centerFirstOrder(row){
        const values=(row||[]).filter(Number.isInteger);
        if(values.length<=1){ return values; }
        const order=[];
        const center=Math.floor((values.length-1)/2);
        order.push(center);
        for(let distance=1;order.length<values.length;distance++){
            if(center+distance<values.length){ order.push(center+distance); }
            if(center-distance>=0){ order.push(center-distance); }
        }
        return order.map(position=>values[position]);
    }

    const REFERENCE_TARGET_ORDER_6=[4,1,3,6,2,5];
    const REFERENCE_TARGET_ORDER_10=[7,2,6,1,5,10,4,9,3,8];

    function autoTargetPriority(indexes){
        const ordered=(indexes||[]).filter(Number.isInteger);
        const owner=battlefieldSlots();
        const snapshot=activeFormationSnapshot(ordered);
        if(owner&&snapshot){
            return owner.getPriorityMonsterIndexes(snapshot,monsterAlive);
        }
        if(typeof monsters!=="undefined"&&ordered.length){
            const explicit=ordered.map(index=>({index:index,order:monsters[index]&&Number(monsters[index].v148TargetOrder)}));
            if(explicit.every(entry=>Number.isFinite(entry.order))){
                return explicit.sort((a,b)=>a.order-b.order).map(entry=>entry.index).filter(monsterAlive);
            }
        }
        return stableFormationRows(ordered).flatMap(centerFirstOrder).filter(monsterAlive);
    }

    window.v148GetFormationRows=stableFormationRows;
    window.v148GetAutoTargetPriority=autoTargetPriority;

    /* A defeated card remains inert except while Revive is explicitly aiming. */
    if(typeof isValidAllyTargetForSkill==="function"){
        const previousIsValidAllyTarget=isValidAllyTargetForSkill;
        isValidAllyTargetForSkill=function(skill,character,index){
            if(!skill||!character){ return false; }
            if(skill.targetType==="deadAlly"){ return numeric(character.hp)<=0; }
            return previousIsValidAllyTarget.apply(this,arguments);
        };
    }

    function markReviveTargets(actionType){
        if(typeof document==="undefined"){ return; }
        document.querySelectorAll(".battle-player.v148-revive-target").forEach(card=>
            card.classList.remove("v148-revive-target")
        );
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[actionType]:null;
        if(!skill||skill.targetType!=="deadAlly"){ return; }
        partyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            const card=document.getElementById("battlePlayerCard"+index);
            if(card&&character&&numeric(character.hp)<=0){
                card.classList.add("ally-targetable","v148-revive-target");
            }
        });
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const previousSetAllyTargets=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const result=previousSetAllyTargets.apply(this,arguments);
            markReviveTargets(actionType);
            return result;
        };
    }

    function markPurifyMindDualTargets(){
        if(typeof document==="undefined"){ return; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.purifyMind:null;
        if(!skill||typeof pendingAction==="undefined"||pendingAction!=="purifyMind"){ return; }
        if(typeof currentBattleMonsters!=="undefined"){
            currentBattleMonsters.forEach(index=>{
                const monster=typeof monsters!=="undefined"?monsters[index]:null;
                const card=document.getElementById("battleMonster"+index);
                if(card){
                    card.classList.toggle("targetable",!!(monster&&monster.alive!==false&&numeric(monster.hp)>0));
                }
            });
        }
        livingPartyIndexes().forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ card.classList.add("ally-targetable"); }
        });
        const prompt=document.getElementById("battleTargetPromptAction");
        if(prompt){ prompt.textContent="選擇 [淨心訣] 的我方或敵方目標"; }
        const targetText=document.getElementById("battleTarget");
        if(targetText){ targetText.textContent="目標：請選擇我方或敵方角色"; }
    }

    if(typeof prepareAction==="function"){
        const previousPrepareAction=prepareAction;
        prepareAction=function(type){
            const result=previousPrepareAction.apply(this,arguments);
            if(
                type==="purifyMind"&&
                typeof actionReady!=="undefined"&&actionReady&&
                typeof pendingAction!=="undefined"&&pendingAction==="purifyMind"
            ){
                markPurifyMindDualTargets();
            }
            return result;
        };
    }

    if(typeof clearBattleTargetSelectionMode==="function"){
        const previousClearTargetMode=clearBattleTargetSelectionMode;
        clearBattleTargetSelectionMode=function(){
            const result=previousClearTargetMode.apply(this,arguments);
            if(typeof document!=="undefined"){
                document.querySelectorAll(".battle-player.v148-revive-target").forEach(card=>
                    card.classList.remove("v148-revive-target")
                );
            }
            return result;
        };
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousPlayCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index,type){
            const entity=side==="monster"
                ?(typeof monsters!=="undefined"?monsters[index]:null)
                :(typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null);
            const defeated=!entity||numeric(entity.hp)<=0||(side==="monster"&&entity.alive===false);
            if(defeated&&type!=="revive"){ return; }
            return previousPlayCardEffect.apply(this,arguments);
        };
    }

    /* Different formal names may coexist.  Only a repeated name is rejected
       by the shared persistent-state owner in 00-main.js. */
    function normalizeAllHardControls(){ return HARD_CONTROL_TYPES.length; }

    /* ----- One support resolver for every party slot. ----- */
    function finishSupport(message){
        if(message&&typeof addBattleLog==="function"){ addBattleLog(message); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    function validateSupportCaster(characterIndex,skill){
        const character=getPartyCharacterByIndex(characterIndex);
        const key=getPartyCharacterKey(characterIndex);
        const level=Math.max(0,Math.floor(numeric(getSkillLevel(key,skill.id))));
        const cost=Math.max(0,numeric(skill.spCost!==undefined?skill.spCost:skill.cost));
        const stats=character?getPartyBattleStats(characterIndex):null;
        if(!character||numeric(character.hp)<=0){ return {error:"施放者已無法行動。"}; }
        if(!stats){ return {error:"施放者的戰鬥資料無法讀取。"}; }
        if(level<=0){ return {error:(character.id||"角色")+"尚未學習"+skill.name+"。"}; }
        if(numeric(character.sp)<cost){ return {error:(character.id||"角色")+"SP不足，無法使用"+skill.name+"。"}; }
        return {character:character,key:key,level:level,cost:cost,stats:stats};
    }

    function animateSupportCast(state,characterIndex,skill,targetId,targetIds,targetSide){
        state.character.sp=Math.max(0,numeric(state.character.sp)-state.cost);
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        if(typeof showSkillNameBadge==="function"){
            showSkillNameBadge(skill.name,skill.element,characterIndex,targetId,targetIds,targetSide);
        }
        if(typeof showPlayerSpPopup==="function"){
            setTimeout(()=>showPlayerSpPopup(state.cost,characterIndex),500);
        }
    }

    function requestedBuffTargets(characterIndex,queued,skill){
        const owner=battlefieldSlots();
        const all=partyIndexes();
        const living=index=>{
            const target=getPartyCharacterByIndex(index);
            return !!(target&&numeric(target.hp)>0);
        };
        if(owner&&typeof owner.ensureAllyFormation==="function"&&typeof owner.resolveAllyTargets==="function"){
            const formation=owner.ensureAllyFormation(all);
            if(skill.targetType==="allyAll"){
                return owner.resolveAllyTargets(formation,null,"all",living);
            }
            if(skill.targetType==="allyTri"){
                const preferred=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
                return owner.resolveAllyTargets(formation,preferred,"allyTri",living);
            }
            const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
            return owner.resolveAllyTargets(formation,selected,"ally",living);
        }
        if(skill.targetType==="allyAll"){ return livingPartyIndexes(); }
        const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(selected);
        return target&&numeric(target.hp)>0?[selected]:[];
    }

    function buffFields(skill,level){
        if(skill.id==="rage"){
            const chance=levelValue(skill.critChanceBonusByLevel||skill.critBonusByLevel,level,0);
            const damage=levelValue(skill.critDamageBonusByLevel||skill.critBonusByLevel,level,0);
            return {bonusPercent:chance,critChanceBonusPercent:chance,critDamageBonusPercent:damage};
        }
        if(skill.id==="dodgeSkill"){ return {percent:numeric(skill.evasionBonusPercent)}; }
        if(skill.id==="rockWall"){ return {percent:numeric(skill.defenseBonusPercent)}; }
        if(skill.id==="earthShield"){ return {percent:numeric(skill.reflectPercent)}; }
        if(skill.id==="dinghaishenzhen"){
            return {resistBonus:numeric(skill.statusResistBonus),accuracyBonusPercent:numeric(skill.accuracyBonusPercent)};
        }
        if(skill.id==="barrier"){
            return {
                sourceSkill:"barrier",barrierRule:"shared",
                remainingBlocks:Math.max(1,numeric(skill.barrierBlockCount)||5)
            };
        }
        return {};
    }

    function resolvePartyBuff(characterIndex,queued,skill,state){
        const requested=requestedBuffTargets(characterIndex,queued,skill);
        if(!requested.length){ return finishSupport(skill.name+"目前沒有有效目標。"); }
        const eligible=requested.filter(index=>{
            const target=getPartyCharacterByIndex(index);
            if(!target||numeric(target.hp)<=0){ return false; }
            if(typeof window.v173CanApplyNamedPersistentState==="function"){
                return window.v173CanApplyNamedPersistentState(target,skill.id,"player",index,skill.name);
            }
            return !activeBuff(target,skill.id);
        });

        animateSupportCast(state,characterIndex,skill,requested[0],requested,"player");
        const extra=buffFields(skill,state.level);
        eligible.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            target.activeBuffs=(target.activeBuffs||[]).filter(buff=>
                !(
                    buff&&buff.type===skill.id&&(
                        numeric(buff.turnsLeft)<=0||
                        skill.id==="barrier"&&numeric(buff.remainingBlocks)<=0
                    )
                )
            );
            const buff=Object.assign({
                type:skill.id,turnsLeft:Math.max(1,numeric(skill.duration)||2)
            },extra);
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,skill.id);
            }
            target.activeBuffs.push(buff);
            if(typeof window.v141PlayCardEffect==="function"){
                const effect=skill.id==="barrier"?"barrier":skill.id==="earthShield"?"shield":"buff";
                window.v141PlayCardEffect("player",index,effect);
            }
        });
        const skipped=requested.length-eligible.length;
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，效果成功套用於"+eligible.length+"名存活友方"+
            (skipped>0?"；"+skipped+"名同名狀態MISS。":"。")
        );
    }

    function healAmounts(skill,state,targetStats,isFlatPartyHeal){
        const exSkill=typeof skillDatabase!=="undefined"?skillDatabase[skill.element+"EX"]:null;
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(state.key,skill.element+"EX"))));
        const multiplier=exSkill&&exLevel>0&&numeric(exSkill.healBonusPercent)>0
            ?1+numeric(exSkill.healBonusPercent)/100:1;
        const hpBase=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(state.level-1);
        const spBase=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(state.level-1);
        const hp=isFlatPartyHeal
            ?Math.floor(hpBase*multiplier)
            :Math.floor(calculateHealingAmount(hpBase,state.stats.intelligence)*multiplier);
        const sp=isFlatPartyHeal
            ?Math.floor(spBase)
            :Math.floor(calculateSPHealingAmount(spBase,state.stats.intelligence));
        return {hp:Math.max(0,hp),sp:Math.max(0,sp),maxHP:numeric(targetStats.maxHP),maxSP:numeric(targetStats.maxSP)};
    }

    function resolvePartyHeal(characterIndex,queued,skill,state){
        const targets=requestedBuffTargets(characterIndex,queued,skill);
        if(!targets.length){ return finishSupport(skill.name+"目前沒有可治療的存活目標。"); }
        animateSupportCast(state,characterIndex,skill,targets[0],targets,"player");
        let hpTotal=0;
        let spTotal=0;
        let cleansedTotal=0;
        targets.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            const targetStats=getPartyBattleStats(index);
            if(!target||!targetStats||numeric(target.hp)<=0){ return; }
            const planned=healAmounts(skill,state,targetStats,skill.id==="healSpell");
            const hp=Math.max(0,Math.min(planned.hp,planned.maxHP-numeric(target.hp)));
            const sp=index===characterIndex?0:Math.max(0,Math.min(planned.sp,planned.maxSP-numeric(target.sp)));
            target.hp=Math.min(planned.maxHP,numeric(target.hp)+planned.hp);
            if(index!==characterIndex){ target.sp=Math.min(planned.maxSP,numeric(target.sp)+planned.sp); }
            if(skill.cleanseAll&&Array.isArray(target.statusEffects)){
                cleansedTotal+=target.statusEffects.length;
                target.statusEffects=[];
            }
            hpTotal+=hp;
            spTotal+=sp;
            if(hp>0&&typeof showPlayerHit==="function"){ showPlayerHit(hp,"heal",index,true); }
            if(sp>0&&typeof showPlayerHit==="function"){ showPlayerHit(sp,"sp",index,true); }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("player",index,"heal"); }
        });
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，我方存活角色共恢復"+
            hpTotal+" HP、"+spTotal+" SP"+
            (skill.cleanseAll?"，並解除"+cleansedTotal+"個負面狀態":"")+"；施放者本人不恢復SP。"
        );
    }

    function resolvePartyRevive(characterIndex,queued,skill,state){
        let targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:null;
        if(targetIndex===null){
            targetIndex=partyIndexes().find(index=>{
                const target=getPartyCharacterByIndex(index);
                return target&&numeric(target.hp)<=0;
            });
        }
        const target=Number.isInteger(targetIndex)?getPartyCharacterByIndex(targetIndex):null;
        if(!target||numeric(target.hp)>0){ return finishSupport("目前選擇的目標不需要復活。"); }
        const targetStats=getPartyBattleStats(targetIndex);
        if(!targetStats){ return finishSupport("復活目標資料無法讀取。"); }

        animateSupportCast(state,characterIndex,skill,targetIndex,[targetIndex],"player");
        const exSkill=typeof skillDatabase!=="undefined"?skillDatabase[skill.element+"EX"]:null;
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(state.key,skill.element+"EX"))));
        const multiplier=exSkill&&exLevel>0&&numeric(exSkill.healBonusPercent)>0
            ?1+numeric(exSkill.healBonusPercent)/100:1;
        const percent=levelValue(skill.reviveHealPercentByLevel,state.level,20);
        const restoredHP=Math.max(1,Math.min(
            numeric(targetStats.maxHP),
            Math.floor(numeric(targetStats.maxHP)*percent/100*multiplier)
        ));
        const reviveMessage=(target.id||"隊友")+"被"+skill.name+"復活，恢復"+restoredHP+" HP。";
        const reviveAtImpact=()=>{
            if(numeric(target.hp)>0){ return; }
            target.hp=restoredHP;
            if(typeof addBattleLog==="function"){ addBattleLog(reviveMessage); }
            if(typeof updateUI==="function"){ updateUI(); }
            if(typeof showPlayerHit==="function"){ showPlayerHit(restoredHP,"heal",targetIndex,true); }
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("player",targetIndex,"revive");
            }
        };
        if(typeof window.v143RunAtTargetHit==="function"){
            window.v143RunAtTargetHit("player",targetIndex,reviveAtImpact,true);
        }else{
            const duration=Math.max(520,numeric(skill.animationDuration)||1800);
            setTimeout(reviveAtImpact,Math.round(duration*7/12));
        }
        return finishSupport();
    }

    function clearEnemyPositiveStates(enemy){
        (enemy&&Array.isArray(enemy.v141TeamBuffs)?enemy.v141TeamBuffs:[]).forEach(buff=>{
            if(!buff){ return; }
            if(buff.type==="rage"){
                if(Number.isFinite(Number(buff.originalAttack))){ enemy.attack=Number(buff.originalAttack); }
                if(Number.isFinite(Number(buff.originalMagicAttack))){ enemy.magicAttack=Number(buff.originalMagicAttack); }
            }else if(buff.type==="resistance"){
                enemy.resistance=Math.max(0,numeric(enemy.resistance)-numeric(buff.amount));
            }else if(buff.type==="dodge"&&Number.isFinite(Number(buff.originalEvasion))){
                enemy.evasion=Number(buff.originalEvasion);
            }
        });
        if(enemy){
            enemy.v141TeamBuffs=[];
            enemy.activeBuffs=[];
            if(enemy.v141Shield){ enemy.v141Shield=null; }
        }
    }

    function resolvePartyStateClear(characterIndex,queued,skill,state){
        const enemyIndex=skill.id==="purifyMind"&&Number.isInteger(queued.target)&&!Number.isInteger(queued.targetAlly)
            ?queued.target:null;
        if(enemyIndex!==null){
            const enemy=typeof monsters!=="undefined"?monsters[enemyIndex]:null;
            const isCurrent=typeof currentBattleMonsters!=="undefined"&&currentBattleMonsters.includes(enemyIndex);
            if(!enemy||!isCurrent||enemy.alive===false||numeric(enemy.hp)<=0){
                return finishSupport(skill.name+"目前沒有有效目標。");
            }
            animateSupportCast(state,characterIndex,skill,enemyIndex,[enemyIndex],"monster");
            clearEnemyPositiveStates(enemy);
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("monster",enemyIndex,"buff");
            }
            return finishSupport(
                (state.character.id||"角色")+"施放"+skill.name+"，解除"+
                (enemy.name||("敵人"+(enemyIndex+1)))+"身上所有增益狀態；負面狀態保留。"
            );
        }

        const targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(targetIndex);
        if(!target||numeric(target.hp)<=0){ return finishSupport(skill.name+"目前沒有有效目標。"); }
        animateSupportCast(state,characterIndex,skill,targetIndex,[targetIndex],"player");
        const negativeCount=Array.isArray(target.statusEffects)?target.statusEffects.length:0;
        const buffCount=Array.isArray(target.activeBuffs)?target.activeBuffs.length:0;
        target.statusEffects=[];
        target.activeBuffs=[];
        if(target.v141Shield){ target.v141Shield=null; }
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect("player",targetIndex,"buff");
        }
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，解除"+
            (target.id||("角色"+(targetIndex+1)))+"身上"+(negativeCount+buffCount)+"個增益／異常狀態。"
        );
    }

    function resolveSupportAction(characterIndex,queued,skill){
        if(typeof activeBattleCharacterIndex!=="undefined"){ activeBattleCharacterIndex=characterIndex; }
        const state=validateSupportCaster(characterIndex,skill);
        if(state.error){ return finishSupport(state.error); }
        if(skill.removeAllStates){ return resolvePartyStateClear(characterIndex,queued,skill,state); }
        if(skill.category==="buff"){ return resolvePartyBuff(characterIndex,queued,skill,state); }
        if(skill.category==="heal"){ return resolvePartyHeal(characterIndex,queued,skill,state); }
        if(skill.category==="revive"){ return resolvePartyRevive(characterIndex,queued,skill,state); }
        return false;
    }

    window.v148ResolveSupportAction=resolveSupportAction;

    if(typeof castBuffSkill==="function"){
        castBuffSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }
    if(typeof castHealSkill==="function"){
        castHealSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }
    if(typeof castReviveSkill==="function"){
        castReviveSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }

    /* Embedded shield bonuses from damage skills also cannot refresh a live buff. */
    function snapshotActivePartyBuffs(){
        return partyIndexes().map(index=>{
            const character=getPartyCharacterByIndex(index);
            const buffs=(character&&character.activeBuffs||[]).filter(buff=>buff&&numeric(buff.turnsLeft)>0);
            return {
                character:character,
                records:buffs.map(buff=>({reference:buff,values:Object.assign({},buff)}))
            };
        }).filter(entry=>entry.character&&entry.records.length);
    }

    function restoreActivePartyBuffs(snapshot){
        snapshot.forEach(entry=>{
            const protectedTypes=new Set(entry.records.map(record=>record.reference.type));
            const current=(entry.character.activeBuffs||[]).filter(buff=>
                !buff||!protectedTypes.has(buff.type)
            );
            entry.records.forEach(record=>{
                Object.assign(record.reference,record.values);
                current.push(record.reference);
            });
            entry.character.activeBuffs=current;
        });
    }

    ["castDamageSkill","castSecondaryCharacterSkill","castPlayer2Skill"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const snapshot=snapshotActivePartyBuffs();
            try{ return previous.apply(this,arguments); }
            finally{ restoreActivePartyBuffs(snapshot); }
        };
    });

    /* Enemy Rage uses one visual trio and never the complete ten-card roster. */
    function activeMonsterTeamBuff(monster,type){
        if(typeof window.v173HasNamedPersistentState==="function"){
            return window.v173HasNamedPersistentState(monster,type);
        }
        return !!(monster&&Array.isArray(monster.v141TeamBuffs)&&monster.v141TeamBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function bestMonsterRageTargets(casterIndex){
        const indexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[];
        const alive=indexes.filter(monsterAlive);
        const owner=battlefieldSlots();
        const snapshot=activeFormationSnapshot(indexes);
        let best=[];
        let bestScore=-1;
        alive.forEach(center=>{
            const trio=owner&&snapshot
                ?owner.resolveEnemyTargets(snapshot,center,"tri",monsterAlive)
                :[center];
            const eligible=trio.filter(target=>!activeMonsterTeamBuff(monsters[target],"rage"));
            const score=eligible.length*100+(center===casterIndex?20:(trio.includes(casterIndex)?10:0));
            if(score>bestScore){ best=trio; bestScore=score; }
        });
        return best.slice(0,3);
    }

    function tryMonsterRage(monsterIndex){
        const caster=monsters[monsterIndex];
        const skill=skillDatabase.rage;
        if(!caster||!caster.alive||numeric(caster.hp)<=0||!skill){ return false; }
        const controlled=(typeof isMonsterFrozen==="function"&&isMonsterFrozen(caster))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(caster));
        if(controlled||Math.random()>.55){ return false; }
        const targets=bestMonsterRageTargets(monsterIndex);
        const cost=Math.max(0,numeric(skill.spCost));
        if(!targets.length||numeric(caster.sp)<cost){ return false; }
        caster.sp=Math.max(0,numeric(caster.sp)-cost);
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||caster.element,monsterIndex);
        }
        let appliedCount=0;
        targets.forEach(index=>{
            const monster=monsters[index];
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    monster,"rage","monster",index,skill.name
                )
            ){ return; }
            const level=Math.max(1,Math.min(
                numeric(skill.maxLevel)||5,
                Math.floor(numeric(caster.v141ForceSkillLevel)||1)
            ));
            const critChance=levelValue(
                skill.critChanceBonusByLevel||skill.critBonusByLevel,level,0
            );
            const critDamage=levelValue(
                skill.critDamageBonusByLevel||skill.critBonusByLevel,level,0
            );
            const buff={
                type:"rage",turnsLeft:Math.max(1,numeric(skill.duration)||3),amount:0,
                bonusPercent:critChance,
                critChanceBonusPercent:critChance,
                critDamageBonusPercent:critDamage,
                originalAttack:numeric(monster.attack),originalMagicAttack:numeric(monster.magicAttack)
            };
            const display={
                type:"rage",v141BuffType:"rage",turnsLeft:buff.turnsLeft,
                bonusPercent:critChance,
                critChanceBonusPercent:critChance,
                critDamageBonusPercent:critDamage
            };
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,"rage");
                window.v173MarkPersistentStateName(display,"rage");
            }
            buff.displayBuff=display;
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
            appliedCount++;
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("monster",index,"buff");
            }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(caster.name+"施放怒火，敵方同排中、左、右有"+appliedCount+"名成功獲得效果，持續3回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const supports=monster&&monster.v141SupportSkillIds||[];
            if(supports.includes("rage")){ return tryMonsterRage(monsterIndex); }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    /* Reflect is already part of the core formula; make it visible and repair
       any alternate attack path that skipped the formula. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const attacker=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const before=livingPartyIndexes().map(index=>{
                const character=getPartyCharacterByIndex(index);
                const percent=typeof getActiveBuffPercent==="function"
                    ?numeric(getActiveBuffPercent(character,"earthShield"))
                    :numeric((character.activeBuffs||[]).find(buff=>buff.type==="earthShield"&&numeric(buff.turnsLeft)>0)?.percent);
                return {index:index,hp:numeric(character.hp),percent:percent};
            });
            let reflected=0;
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog){
                addBattleLog=function(message){
                    const match=String(message||"").match(/反傷造成.*?(\d+)點傷害/);
                    if(match){
                        const amount=numeric(match[1]);
                        reflected+=amount;
                        if(amount>0&&typeof showMonsterHit==="function"){
                            showMonsterHit(monsterIndex,amount,"hp");
                        }
                    }
                    return previousLog.apply(this,arguments);
                };
            }
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{ if(previousLog){ addBattleLog=previousLog; } }

            if(attacker&&reflected===0){
                const expected=before.reduce((sum,entry)=>{
                    const character=getPartyCharacterByIndex(entry.index);
                    const lost=Math.max(0,entry.hp-numeric(character&&character.hp));
                    return sum+(entry.percent>0&&lost>0?Math.max(1,Math.floor(lost*entry.percent/100)):0);
                },0);
                if(expected>0){
                    attacker.hp=Math.max(0,numeric(attacker.hp)-expected);
                    if(typeof showMonsterHit==="function"){ showMonsterHit(monsterIndex,expected,"hp"); }
                    if(typeof addBattleLog==="function"){ addBattleLog("萬象土盾反彈"+expected+"點傷害給"+attacker.name+"。"); }
                    if(numeric(attacker.hp)<=0&&typeof killMonster==="function"){ killMonster(monsterIndex); }
                }
            }
            return result;
        };
    }

    /* A dead enemy team ends resolution before a queued second player acts. */
    function enemiesHaveNoHp(){
        if(typeof currentBattleMonsters==="undefined"||!currentBattleMonsters.length){ return false; }
        return currentBattleMonsters.every(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            return !monster||monster.alive===false||numeric(monster.hp)<=0;
        });
    }

    function settleDefeatedEnemies(){
        if(typeof battleActive!=="undefined"&&!battleActive){ return true; }
        if(!enemiesHaveNoHp()){ return false; }
        if(typeof currentBattleMonsters!=="undefined"&&typeof killMonster==="function"){
            currentBattleMonsters.forEach(index=>{
                const monster=monsters[index];
                if(monster&&monster.alive!==false&&numeric(monster.hp)<=0){ killMonster(index); }
            });
        }
        if(typeof checkBattleEnd==="function"&&checkBattleEnd()){ return true; }
        return typeof battleActive!=="undefined"&&!battleActive;
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            if(settleDefeatedEnemies()){ return; }
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            if(queued&&queued.vFixedAutoEnemyPrimary===true){
                const nextTarget=autoTargetPriority(
                    typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]
                )[0];
                if(Number.isInteger(nextTarget)){ queued.target=nextTarget; }
            }
            const skill=queued&&typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
            if(queued&&skill&&["buff","heal","revive"].includes(skill.category)){
                return resolveSupportAction(characterIndex,Object.assign({},queued),skill);
            }
            return previousResolveQueuedAction.apply(this,arguments);
        };
    }

    /* Zero-HP settlement and queue advancement are owned by 00-main.js.
       This feature module must never Promise-gate or replace either owner. */

    /* ----- Formal daily dungeons: one shared 3-wave × 6-enemy battle flow. ----- */
    const DAILY_ELEMENTS=["fire","water","earth","wind"];
    const DAILY_DUNGEON_META={
        exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP",legacyType:"exp"},
        material:{title:"材料副本",requirement:"任一角色達到10級",reward:"材料寶箱 ×1～3",legacyType:"material"},
        gold:{title:"金幣副本",requirement:"任一角色達到10級",reward:"大量金幣",legacyType:"equipment"}
    };
    let dailyDungeonSequence=null;
    let pendingDailyExpReward=null;
    let pendingDailyGoldReward=0;

    function getDailyDungeonLevel(){
        return typeof window.v132GetDungeonMonsterLevel==="function"
            ?Math.max(1,Math.floor(numeric(window.v132GetDungeonMonsterLevel())||1))
            :Math.max(1,...partyIndexes().map(index=>numeric(getPartyCharacterByIndex(index)?.level)||1));
    }

    function dailyPartyContext(){
        const indexes=partyIndexes().slice(0,3);
        const partySize=Math.max(1,indexes.length||1);
        const highestLevel=Math.max(1,...indexes.map(index=>numeric(getPartyCharacterByIndex(index)?.level)||1));
        return {partySize:partySize,highestLevel:highestLevel,soloProtected:partySize===1&&highestLevel<=20};
    }

    function dailyRankForSlot(wave,slot,soloProtected){
        if(wave===1){ return null; }
        if(soloProtected){
            if(wave===2){ return slot===4?"elite":null; }
            if(slot===4){ return "boss"; }
            return slot===3?"elite":null;
        }
        if(wave===2){ return slot>=4?"elite":null; }
        if(slot===4){ return "boss"; }
        if(slot===3||slot===5){ return "elite"; }
        return null;
    }

    function dailyMonsterName(type,rank){
        const names={
            exp:{regular:"修行弟子",elite:"修行精英",boss:"修行教頭"},
            material:{regular:"礦脈守衛",elite:"礦脈精英",boss:"礦脈統領"},
            gold:{regular:"金庫守衛",elite:"金庫精英",boss:"金庫總管"}
        };
        return names[type][rank||"regular"];
    }

    function buildDailyWave(type,wave,level,context){
        const roster=[];
        for(let slot=0;slot<6;slot++){
            const rank=dailyRankForSlot(wave,slot,!!(context&&context.soloProtected));
            const element=DAILY_ELEMENTS[(wave*2+slot)%DAILY_ELEMENTS.length];
            const monster=typeof window.v132BuildDungeonMonster==="function"
                ?window.v132BuildDungeonMonster(dailyMonsterName(type,rank),level,element,rank||undefined)
                :makeZoneMonster(dailyMonsterName(type,rank),level,element,rank||undefined);
            monster.v132Dungeon=true;
            monster.v173DailyDungeonType=type;
            monster.v141DungeonStage=wave;
            monster.v141FormationRow=slot<3?0:1;
            monster.v141FormationPosition=slot%3;
            monster.v148TargetOrder=REFERENCE_TARGET_ORDER_6[slot];
            monster.v173DailySoloProtected=!!(context&&context.soloProtected);
            roster.push(monster);
        }
        return roster;
    }

    function buildDailyDungeonWaves(type){
        const level=getDailyDungeonLevel();
        const context=dailyPartyContext();
        return {
            level:level,
            partySize:context.partySize,
            highestLevel:context.highestLevel,
            soloProtected:context.soloProtected,
            waves:[1,2,3].map(wave=>buildDailyWave(type,wave,level,context))
        };
    }
    window.v148BuildDailyDungeonWaves=buildDailyDungeonWaves;

    function dailyDungeonAvailable(meta){
        return !window.v132IsDungeonAvailable||window.v132IsDungeonAvailable(meta.legacyType);
    }

    function hasLevel10Character(){
        return partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=10);
    }

    function confirmFormalDailyDungeon(meta){
        if(typeof window.rpgConfirm!=="function"){ return Promise.resolve(true); }
        const protectedSolo=dailyPartyContext().soloProtected;
        const layout=protectedSolo
            ?"第1輪：6普通；第2輪：5普通＋1精英；第3輪：4普通＋1精英＋1BOSS。"
            :"第1輪：6普通；第2輪：4普通＋2精英；第3輪：3普通＋2精英＋1BOSS。";
        return window.rpgConfirm(
            "確定要進入「"+meta.title+"」嗎？\n\n共3輪，每輪固定前排3隻＋後排3隻，共18隻敵人。\n"+layout,
            {title:"副本確認",confirmText:"進入副本",cancelText:"返回"}
        );
    }

    function resetBattleAdvanceTimers(){
        if(typeof timerId!=="undefined"&&timerId){ clearInterval(timerId); timerId=null; }
        if(typeof battleAdvanceTimeoutId!=="undefined"&&battleAdvanceTimeoutId){
            clearTimeout(battleAdvanceTimeoutId);
            battleAdvanceTimeoutId=null;
        }
        if(typeof battleAdvanceScheduled!=="undefined"){ battleAdvanceScheduled=false; }
    }

    function activateDailyDungeonWave(sequence,nextIndex){
        if(!sequence||dailyDungeonSequence!==sequence||!window.v132ActiveDungeonRun){ return; }
        const wave=sequence.waves[nextIndex];
        sequence.waveIndex=nextIndex;
        if(window.v132ActiveDungeonRun){
            window.v132ActiveDungeonRun.partySize=sequence.partySize;
            window.v132ActiveDungeonRun.highestPartyLevel=sequence.highestPartyLevel;
            window.v132ActiveDungeonRun.dailyDungeonType=sequence.type;
        }
        monsters=wave;
        currentZone="dungeon";
        currentBattleMonsters=wave.map((monster,index)=>index);
        currentBattleMonsters.forEach(index=>{
            const monster=monsters[index];
            monster.alive=true;
            monster.hp=monster.maxHP;
            monster.sp=monster.maxSP;
            monster.statusEffects=[];
        });
        battleActive=true;
        battleToken++;
        turn=1;
        actionReady=false;
        pendingAction=null;
        resetBattleAdvanceTimers();
        if(typeof closeMenus==="function"){ closeMenus(); }
        if(typeof clearBattleTargetSelectionMode==="function"){ clearBattleTargetSelectionMode(); }
        const slotOwner=battlefieldSlots();
        if(slotOwner){ slotOwner.clearActiveEnemySnapshot(); }
        renderBattle();
        const priority=autoTargetPriority(currentBattleMonsters);
        selectedMonster=priority.length?priority[0]:0;
        if(typeof autoConfig!=="undefined"&&autoConfig){ autoBattle=!!autoConfig.enabled; }
        if(typeof window.v131SyncElementBoxForBattle==="function"){
            window.v131SyncElementBoxForBattle({silent:true});
        }
        if(typeof syncBattleAutoSettings==="function"){ syncBattleAutoSettings(); }
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof addBattleLog==="function"){
            addBattleLog("第"+(nextIndex+1)+"輪開始：前排3隻、後排3隻敵人進場。");
        }
        startTurn(battleToken);
    }

    function advanceDailyDungeonWave(){
        const sequence=dailyDungeonSequence;
        if(!sequence||sequence.waveIndex>=2){ return false; }
        sequence.totalTurns+=Math.max(1,Math.floor(numeric(typeof turn!=="undefined"?turn:1)));
        /* This is still the same battle session.  Keeping the battle flag true
           prevents the Element Box out-of-battle recovery loop from firing in
           the short handoff between two waves. */
        battleActive=true;
        actionReady=false;
        pendingAction=null;
        resetBattleAdvanceTimers();
        battleToken++;
        if(typeof closeMenus==="function"){ closeMenus(); }
        if(typeof addBattleLog==="function"){
            addBattleLog("第"+(sequence.waveIndex+1)+"輪突破，下一輪敵人無縫接戰！");
        }
        const nextIndex=sequence.waveIndex+1;
        setTimeout(()=>activateDailyDungeonWave(sequence,nextIndex),360);
        return true;
    }

    function finishDailyExpReward(amount){
        const granted=Math.max(0,Math.floor(numeric(amount)));
        if(granted<=0){ return; }
        sharedExp=Math.max(0,numeric(sharedExp)+granted);
        if(typeof addBattleLog==="function"){
            addBattleLog("經驗副本：共用經驗池獲得"+granted+" EXP。");
        }
        pendingDailyExpReward=null;
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
        showPage("dungeon");
        if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
    }

    function showDailyExpReward(baseExp){
        pendingDailyExpReward={baseExp:Math.max(0,Math.floor(numeric(baseExp)))};
        const html='<div class="v132-reward-modal-inner"><h3>經驗副本挑戰成功！</h3>'+
            '<p>共用經驗池可獲得：<b>'+pendingDailyExpReward.baseExp.toLocaleString("zh-TW")+' EXP</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v148ClaimDailyExpReward(false)">直接領取</button>'+
            '<button type="button" onclick="v148ClaimDailyExpReward(true)">看廣告雙倍領取</button>'+
            '<span class="v132-reward-note">獎勵直接加入共用經驗池，不再指定角色。</span></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyExpReward=function(doubled){
        const pending=pendingDailyExpReward;
        if(!pending){ return; }
        const grant=multiplier=>finishDailyExpReward(Math.floor(pending.baseExp*multiplier));
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{
            grant(1);
        }
    };

    function goldDungeonReward(level){
        return Math.max(0,Math.floor(2000+Math.max(1,numeric(level))*50));
    }
    window.v148GetGoldDungeonReward=goldDungeonReward;

    function showDailyGoldReward(amount){
        pendingDailyGoldReward=Math.max(0,Math.floor(numeric(amount)));
        const html='<div class="v132-reward-modal-inner"><h3>金幣副本挑戰成功！</h3>'+
            '<p>可獲得金幣：<b>'+pendingDailyGoldReward.toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v148ClaimDailyGoldReward(false)">直接領取</button>'+
            '<button type="button" onclick="v148ClaimDailyGoldReward(true)">看廣告雙倍領取</button></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyGoldReward=function(doubled){
        const grant=multiplier=>{
            const amount=Math.floor(pendingDailyGoldReward*multiplier);
            if(amount<=0){ return; }
            gold=Math.max(0,numeric(gold)+amount);
            pendingDailyGoldReward=0;
            if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
            if(typeof saveGame==="function"){ saveGame(); }
            if(typeof addBattleLog==="function"){ addBattleLog("金幣副本結算，獲得"+amount+"金幣。"); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            showPage("dungeon");
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
        };
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{ grant(1); }
    };

    async function beginFormalDailyDungeon(type){
        const meta=DAILY_DUNGEON_META[type];
        if(!meta||dailyDungeonSequence||typeof window.v132LaunchDungeonBattle!=="function"){ return; }
        if(!dailyDungeonAvailable(meta)){
            alert(meta.title+"今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10Character()){
            alert(meta.title+"需要任一角色達到10級才能開啟。");
            return;
        }
        if(!await confirmFormalDailyDungeon(meta)){ return; }
        const built=buildDailyDungeonWaves(type);
        const baseExp=type==="exp"&&typeof window.v139GetExpDungeonRewardExp==="function"
            ?Math.max(0,Math.floor(numeric(window.v139GetExpDungeonRewardExp()))):0;
        const sequence={
            type:type,meta:meta,level:built.level,partySize:built.partySize,highestPartyLevel:built.highestLevel,soloProtected:built.soloProtected,waves:built.waves,waveIndex:0,totalTurns:0,baseExp:baseExp
        };
        dailyDungeonSequence=sequence;
        const started=window.v132LaunchDungeonBattle(sequence.waves[0],function(outcome){
            const active=dailyDungeonSequence||sequence;
            if(outcome.result!=="win"){
                dailyDungeonSequence=null;
                showPage("dungeon");
                if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
                return;
            }
            active.totalTurns+=Math.max(1,Math.floor(numeric(outcome.turnsUsed)||1));
            dailyDungeonSequence=null;
            if(type==="exp"){
                showDailyExpReward(active.baseExp);
            }else if(type==="material"){
                const count=active.totalTurns<15?3:active.totalTurns<30?2:1;
                if(typeof window.v132ClaimMaterialDungeonReward==="function"&&typeof window.v132ShowRewardModal==="function"){
                    const html='<div class="v132-reward-modal-inner"><h3>材料副本挑戰成功！</h3><p>獲得材料寶箱 ×'+count+'</p>'+
                        '<div class="v132-reward-actions"><button type="button" onclick="v132ClaimMaterialDungeonReward('+count+',false)">直接領取</button>'+
                        '<button type="button" onclick="v132ClaimMaterialDungeonReward('+count+',true)">看廣告雙倍領取</button></div></div>';
                    window.v132ShowRewardModal(html);
                }
            }else{
                showDailyGoldReward(goldDungeonReward(active.level));
            }
        });
        if(started===false){ dailyDungeonSequence=null; }
        else if(window.v132ActiveDungeonRun){
            window.v132ActiveDungeonRun.partySize=sequence.partySize;
            window.v132ActiveDungeonRun.highestPartyLevel=sequence.highestPartyLevel;
            window.v132ActiveDungeonRun.dailyDungeonType=type;
        }
    }

    window.v132BeginExpDungeon=function(){ return beginFormalDailyDungeon("exp"); };
    window.v132BeginMaterialDungeon=function(){ return beginFormalDailyDungeon("material"); };
    /* Compatibility name retained so existing buttons/saves do not need a migration. */
    window.v132BeginEquipmentDungeon=function(){ return beginFormalDailyDungeon("gold"); };
    window.v148BeginGoldDungeon=window.v132BeginEquipmentDungeon;

    if(typeof winBattle==="function"){
        const previousWinBattle=winBattle;
        winBattle=function(){
            if(dailyDungeonSequence&&window.v132ActiveDungeonRun&&dailyDungeonSequence.waveIndex<2){
                if(advanceDailyDungeonWave()){ return; }
            }
            return previousWinBattle.apply(this,arguments);
        };
    }

    function renderFormalDailyDungeonList(){
        const cards=[
            ["exp",DAILY_DUNGEON_META.exp,"v132BeginExpDungeon"],
            ["material",DAILY_DUNGEON_META.material,"v132BeginMaterialDungeon"],
            ["gold",DAILY_DUNGEON_META.gold,"v132BeginEquipmentDungeon"]
        ];
        return '<div class="v141-dungeon-cover-list">'+cards.map(([type,meta,action])=>{
            const available=dailyDungeonAvailable(meta);
            return '<article class="v141-dungeon-cover-card" data-dungeon-cover="'+type+'">'+
                '<div class="v141-dungeon-cover-art"><span>'+meta.title+'</span><small>3輪 × 每輪6隻</small></div>'+
                '<div class="v141-dungeon-cover-info"><b>'+meta.title+'</b><span>開放：'+meta.requirement+'</span></div>'+
                '<div class="v141-dungeon-cover-actions"><button type="button" onclick="v148ShowDailyDungeonPreview(\''+type+'\')">獎勵預覽</button>'+
                '<button type="button" '+(available?'onclick="'+action+'()"':'disabled')+'>挑戰</button></div>'+
                '<div class="v141-dungeon-remaining">'+(available?'可挑戰':'今日已完成')+'</div></article>';
        }).join("")+'</div>';
    }

    function v17361DailyRewardVisual(type){
        if(type==="material"){
            return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon material" aria-label="材料寶箱與礦石">'+
                '<img class="v17361-chest-art" src="assets/items/chests/dungeon-chest.png" alt="材料寶箱">'+
                '<img class="v17361-ore-mini" src="assets/items/materials/ore.png" alt="礦石">'+
                '<em>1–3</em></div></div>';
        }
        if(type==="gold"){
            return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon cover" aria-label="金幣獎勵">'+
                '<img src="assets/dungeons/covers/gold-v17344.png" alt="金幣"></div></div>';
        }
        return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon" aria-label="經驗獎勵">'+
            '<img src="assets/ui/home-offline-exp.png" alt="經驗"></div></div>';
    }
    window.v148ShowDailyDungeonPreview=function(type){
        const meta=DAILY_DUNGEON_META[type];
        if(!meta||typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner v17361-reward-preview"><h3>'+meta.title+'獎勵預覽</h3>'+v17361DailyRewardVisual(type)+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };

    if(typeof renderDungeonTabContent==="function"){
        const previousRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){ return renderFormalDailyDungeonList(); }
            return previousRenderDungeonTabContent.apply(this,arguments);
        };
    }

    /* ----- Quest notification: a ready commission lights its own tab too. ----- */
    function questGroupRewardReady(definitions,state){
        return !!(definitions&&state&&state.claimed&&(definitions||[]).some(quest=>
            quest&&!state.claimed[quest.id]&&
            numeric(state.progress&&state.progress[quest.id])>=Math.max(1,numeric(quest.goal)||1)
        ));
    }

    function questRewardNoticeState(){
        if(typeof ensureDailyQuestsCurrent==="function"){ ensureDailyQuestsCurrent(); }
        const daily=typeof dailyQuestDefinitions!=="undefined"&&typeof dailyQuestState!=="undefined"
            ?questGroupRewardReady(dailyQuestDefinitions,dailyQuestState):false;
        const commission=typeof commissionQuestDefinitions!=="undefined"&&typeof commissionQuestState!=="undefined"
            ?questGroupRewardReady(commissionQuestDefinitions,commissionQuestState):false;
        return {daily:daily,commission:commission,any:daily||commission};
    }

    function questRewardReady(){ return questRewardNoticeState().any; }

    function setQuestNoticeDot(target,show,label){
        if(!target||!target.querySelector){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot");
        if(show&&!dot&&typeof document!=="undefined"){
            dot=document.createElement("span");
            dot.className="v141-notice-dot";
            dot.setAttribute("aria-label",label||"任務獎勵可領取");
            target.appendChild(dot);
        }else if(!show&&dot){ dot.remove(); }
    }

    function syncQuestNoticeDots(){
        if(typeof document==="undefined"){ return; }
        const notices=questRewardNoticeState();
        const home=document.getElementById("homeIconQuest");
        setQuestNoticeDot(home&&home.parentElement?home.parentElement:home,notices.any,"任務獎勵可領取");
        document.querySelectorAll("#mapPageNav button[aria-label='任務'],#v141DungeonNav button[aria-label='任務']")
            .forEach(button=>setQuestNoticeDot(button,notices.any,"任務獎勵可領取"));
        document.querySelectorAll("#homeFeatureModal.quest-mode .quest-tab").forEach(tab=>{
            const marker=((tab.getAttribute("onclick")||"")+" "+(tab.textContent||"")).toLowerCase();
            if(marker.includes("commission")||marker.includes("委託")){
                setQuestNoticeDot(tab,notices.commission,"委託任務獎勵可領取");
            }else if(marker.includes("daily")||marker.includes("每日")){
                setQuestNoticeDot(tab,notices.daily,"每日任務獎勵可領取");
            }
        });
    }
    window.v148SyncQuestNoticeDots=syncQuestNoticeDots;

    if(typeof window.v141UpdateNotificationDots==="function"){
        const previousNotificationDots=window.v141UpdateNotificationDots;
        window.v141UpdateNotificationDots=function(){
            const result=previousNotificationDots.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    if(typeof openHomeFeature==="function"){
        const previousOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(){
            const result=previousOpenHomeFeature.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    /* ----- Shared Gameplay / Dungeon navigation and movement. ----- */
    const CONTEXT_NAV_ITEMS=Object.freeze([
        Object.freeze(["角色","assets/ui/nav-character.png","openHomeFeature('character')"]),
        Object.freeze(["背包","assets/ui/nav-backpack.png","v148OpenContextInventory()"]),
        Object.freeze(["秘寶","assets/ui/nav-relic-v175.webp","v148OpenContextRelic()"]),
        Object.freeze(["元素匣","assets/ui/nav-element-box.png","openHomeFeature('autoBattleSettings')"])
    ]);

    function contextNavMarkup(returnAction){
        const buttons=CONTEXT_NAV_ITEMS.map(item=>item.slice());
        buttons.push(["返回","assets/ui/map-return.png",returnAction]);
        return buttons.map(button=>'<button class="nav-button nav-art-button-wrap" onclick="'+button[2]+'" aria-label="'+button[0]+'"><img class="nav-art-button" src="'+button[1]+'" alt=""><span class="nav-sr-only">'+button[0]+'</span></button>').join("");
    }

    function contextNavMatches(nav,returnAction){
        const buttons=Array.from(nav&&nav.children||[]);
        if(buttons.length!==5){ return false; }
        const labels=buttons.map(button=>button&&typeof button.getAttribute==="function"?button.getAttribute("aria-label"):"").join("|");
        if(labels!=="角色|背包|秘寶|元素匣|返回"){ return false; }
        const relicImage=buttons[2]&&typeof buttons[2].querySelector==="function"?buttons[2].querySelector("img"):null;
        if(!relicImage||relicImage.getAttribute("src")!=="assets/ui/nav-relic-v175.webp"){ return false; }
        const action=buttons[4]&&typeof buttons[4].getAttribute==="function"?buttons[4].getAttribute("onclick"):"";
        return action===returnAction;
    }

    function renderContextNav(nav,returnAction,mode){
        if(!nav){ return; }
        if(nav.dataset.v148Mode!==mode||!contextNavMatches(nav,returnAction)){
  nav.innerHTML=contextNavMarkup(returnAction);
  nav.dataset.v148Mode=mode;
        }
        nav.dataset.v146Columns="5";
    }

    function dungeonReturnAction(abyssMapActive,abyssSelectionActive){
        return abyssMapActive
  ?(typeof window.v174AbyssBackToSelection==="function"?"v174AbyssBackToSelection()":"v146ExitAbyssMap()")
  :(abyssSelectionActive?"v174AbyssLeaveToGameplay()":"showPage('home')");
    }

    function activeGameplayPageId(){
        const ids=["gameplayPage","bossPage","towerPage"];
        for(const id of ids){
  const page=document.getElementById(id);
  if(page&&page.classList&&page.classList.contains("active")){ return id; }
        }
        return "";
    }

    window.v148ReturnFromGameplay=function(){
        const activeId=activeGameplayPageId();
        if(activeId&&activeId!=="gameplayPage"&&typeof window.vGameplayBackToHub==="function"){
  window.vGameplayBackToHub();
        }else if(typeof showPage==="function"){
  showPage(activeId&&activeId!=="gameplayPage"?"gameplay":"home");
        }
    };

    window.v148OpenContextInventory=function(){
        if(typeof document==="undefined"||typeof openMapInventoryOverlay!=="function"){ return false; }
        const dungeonPage=document.getElementById("dungeonPage");
        const dungeonActive=!!(dungeonPage&&dungeonPage.classList&&dungeonPage.classList.contains("active"));
        const gameplayPageId=activeGameplayPageId();
        if(dungeonActive||!gameplayPageId){ return openMapInventoryOverlay(); }
        if(typeof battleActive!=="undefined"&&battleActive){ return false; }

        const mapPage=document.getElementById("mapPage");
        const mapWasActive=!!(mapPage&&mapPage.classList&&mapPage.classList.contains("active"));
        if(mapPage&&!mapWasActive){ mapPage.classList.add("active"); }
        try{
            return openMapInventoryOverlay();
        }finally{
            if(mapPage&&!mapWasActive){ mapPage.classList.remove("active"); }
        }
    };

    window.v148OpenContextRelic=function(){
        if(typeof window.v174OpenRelicPage==="function"){ return window.v174OpenRelicPage(); }
        if(typeof openHomeFeature==="function"){ return openHomeFeature("relic"); }
        return false;
    };

    function syncContextNavigation(){
        if(typeof document==="undefined"){ return; }
        const page=document.getElementById("dungeonPage");
        const app=document.getElementById("app");
        const gameplayPageId=activeGameplayPageId();
        const dungeonActive=!!(page&&page.classList&&page.classList.contains("active"));
        const gameplayActive=!!gameplayPageId;
        const contextActive=dungeonActive||gameplayActive;
        if(app&&app.classList&&typeof app.classList.toggle==="function"){
  app.classList.toggle("v148-context-nav-active",contextActive);
        }

        const abyssMapActive=!!(dungeonActive&&page.querySelector(".v141-abyss-shell"));
        const abyssSelectionActive=!!(dungeonActive&&page.querySelector(".v174-abyss-selection,.v174-abyss-complete,.v141-abyss-intro"));
        let topReturn=document.getElementById("v146AbyssReturn");
        if(abyssMapActive&&!topReturn&&typeof document.createElement==="function"){
  topReturn=document.createElement("button");
  topReturn.id="v146AbyssReturn";
  topReturn.type="button";
  topReturn.className="v146-abyss-return";
  topReturn.setAttribute("aria-label","返回上一層");
  topReturn.innerHTML='<img src="assets/ui/map-return.png" alt="">';
  topReturn.onclick=window.v146ExitAbyssMap;
  page.appendChild(topReturn);
        }else if(!abyssMapActive&&topReturn){
  topReturn.remove();
        }

        let nav=document.getElementById("v141DungeonNav");
        if(contextActive&&!nav&&typeof document.createElement==="function"){
  nav=document.createElement("div");
  nav.id="v141DungeonNav";
  nav.className="bottom-nav map-page-nav v141-dungeon-nav v148-context-nav";
  const owner=document.getElementById("game-content")||app;
  if(owner&&typeof owner.appendChild==="function"){ owner.appendChild(nav); }
        }
        if(!nav||!contextActive){ return; }
        if(nav.classList&&typeof nav.classList.add==="function"){ nav.classList.add("v148-context-nav"); }

        const returnAction=gameplayActive&&!dungeonActive
  ?"v148ReturnFromGameplay()"
  :dungeonReturnAction(abyssMapActive,abyssSelectionActive);
        const mode=gameplayActive&&!dungeonActive
  ?"gameplay:"+gameplayPageId
  :(abyssMapActive?"abyss-map":(abyssSelectionActive?"abyss-selection":"daily"));
        renderContextNav(nav,returnAction,mode);
    }

    function scheduleDungeonSync(){ setTimeout(syncContextNavigation,0); }
    if(typeof switchDungeonTab==="function"){
        const previousSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(){
            const result=previousSwitchDungeonTab.apply(this,arguments);
            scheduleDungeonSync();
            syncQuestNoticeDots();
            return result;
        };
    }
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            scheduleDungeonSync();
            syncQuestNoticeDots();
            return result;
        };
    }
    ["v141StartAbyss","v141ResetAbyss"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            scheduleDungeonSync();
            return result;
        };
    });

    if(typeof window.v141AbyssMoveByEvent==="function"){
        const previousAbyssMove=window.v141AbyssMoveByEvent;
        window.v141AbyssMoveByEvent=function(event){
            const map=document.getElementById("v141AbyssMap");
            const playerElement=document.getElementById("v141AbyssPlayer");
            if(map&&playerElement&&map.dataset.v146Moving==="1"){
                const mapRect=map.getBoundingClientRect();
                const playerRect=playerElement.getBoundingClientRect();
                if(mapRect.width&&mapRect.height&&playerRect.width&&playerRect.height){
                    const x=Math.max(4,Math.min(96,(playerRect.left+playerRect.width/2-mapRect.left)/mapRect.width*100));
                    const y=Math.max(8,Math.min(94,(playerRect.top+playerRect.height/2-mapRect.top)/mapRect.height*100));
                    playerElement.style.transition="none";
                    playerElement.style.left=x+"%";
                    playerElement.style.top=y+"%";
                    void playerElement.offsetWidth;
                }
                map.dataset.v146Moving="0";
                map.classList.remove("v146-moving");
            }
            return previousAbyssMove.apply(this,arguments);
        };
    }

    /* Manual patrol click movement is retired; automatic roaming keeps the
       original 1.8-second natural route and cannot inherit a manual duration. */
    function installPatrolClickBlocker(){
        if(typeof document==="undefined"){ return; }
        const page=document.getElementById("mapPage");
        if(!page||page.dataset.v148ManualMoveBlocked==="1"){ return; }
        page.dataset.v148ManualMoveBlocked="1";
        page.addEventListener("click",event=>{
            if(event.target&&event.target.closest&&event.target.closest(
                "button,#v141TaskTracker,[id^='mapMonster'],#v131PatrolAppearanceSwitchWrap,#mapBattleOverlay"
            )){ return; }
            event.stopImmediatePropagation();
        },true);
    }

    function decoratePatrolRanks(){
        if(typeof document==="undefined"||typeof monsters==="undefined"){ return; }
        monsters.forEach((monster,index)=>{
            const card=document.getElementById("mapMonster"+index);
            if(!card||!monster){ return; }
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):monster.v141BattleRank;
            card.dataset.rank=rank==="boss"?"boss":rank==="elite"?"elite":"regular";
        });
    }

    if(typeof updateMapMonsterIcons==="function"){
        const previousUpdateMapMonsterIcons=updateMapMonsterIcons;
        updateMapMonsterIcons=function(){
            const result=previousUpdateMapMonsterIcons.apply(this,arguments);
            decoratePatrolRanks();
            return result;
        };
    }

    if(typeof startPatrolCharacterWalking==="function"){
        const previousStartPatrol=startPatrolCharacterWalking;
        startPatrolCharacterWalking=function(){
            const wrap=document.getElementById("patrolCharacterWrap");
            const image=document.getElementById("patrolCharacterImg");
            if(wrap){
                wrap.classList.add("v148-auto-route");
                wrap.style.transition="left 1.8s ease-in-out, top 1.8s ease-in-out";
            }
            if(image){ image.classList.remove("v141-manual-walking"); }
            return previousStartPatrol.apply(this,arguments);
        };
    }
    if(typeof stopPatrolCharacterWalking==="function"){
        const previousStopPatrol=stopPatrolCharacterWalking;
        stopPatrolCharacterWalking=function(){
            const wrap=document.getElementById("patrolCharacterWrap");
            if(wrap){ wrap.classList.remove("v148-auto-route"); }
            return previousStopPatrol.apply(this,arguments);
        };
    }

    function boot(){
        installPatrolClickBlocker();
        decoratePatrolRanks();
        syncContextNavigation();
        syncQuestNoticeDots();
        normalizeAllHardControls();
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        let queued=false;
        const observer=new MutationObserver(()=>{
            if(queued){ return; }
            queued=true;
            requestAnimationFrame(()=>{ queued=false; syncContextNavigation(); syncQuestNoticeDots(); });
        });
        const observe=()=>observer.observe(document.body,{childList:true,subtree:true});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",observe,{once:true}); }
        else{ observe(); }
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v148SyncContextNavigation=syncContextNavigation;
    window.v148SyncDungeonShell=syncContextNavigation;
    window.v148SettleDefeatedEnemies=settleDefeatedEnemies;
    window.v148Diagnostics=function(){
        const database=typeof skillDatabase!=="undefined"?skillDatabase:null;
        return {
            version:VERSION,rageTargetType:database&&database.rage&&database.rage.targetType,
            duplicateBuffRefresh:false,hardControlsExclusive:false,healCasterSp:false,
            reviveDeadTarget:true,dungeonTouchScroll:true,abyssRedirectable:true,
            patrolManualMovement:false,shopIcon:"assets/ui/home-shop-v147.png",
            dailyDungeonWaves:3,dailyDungeonEnemiesPerWave:6,goldDungeon:true
        };
    };
})();


/* bundled source: js/43-v149-skill-ui-rules.js */
/* =====================================================
   V149 — final four-element rules, shop alignment and combat feedback
===================================================== */
(function installV149SkillUiRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v149SkillUiRulesInstalled){ return; }
    window.__v149SkillUiRulesInstalled=true;

    const VERSION="149";
    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function copyValue(value){ return Array.isArray(value)?value.slice():value; }

    const SKILL_CLEANUP_FIELDS={
        flameSlash:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        fireCritical:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        explosiveFlurry:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        dragonSlash:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        petrifyFist:["allyShieldByLevel"],
        stoneBreakSky:["allyShieldByLevel"],
        earthquakeCrush:["selfShieldByLevel"],
        flyingSandStrike:["petrifyChanceByLevel","petrifyDuration"],
        dustStorm:["defenseDownChance","defenseDownByLevel","defenseDownDuration"]
    };

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        (SKILL_CLEANUP_FIELDS[id]||[]).forEach(key=>{ delete skillDatabase[id][key]; });
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    const SKILLS={
        flameSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:30,damagePerLevel:6,spCost:10,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,
            description:"初次學習需2技能點。對單體造成30點傷害，消耗10 SP；目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        fireCritical:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:45,damagePerLevel:9,spCost:28,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,requires:["flameSlash"],
            description:"需先學習火焰斬。初次學習需10技能點，對單體造成45點傷害，消耗28 SP；目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        explosiveFlurry:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:50,damagePerLevel:10,spCost:47,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,requires:["fireCritical"],
            description:"需先學習會心一擊。初次學習需20技能點，對同排中、左、右最多3名目標各造成50點傷害，消耗47 SP；任一目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+10。"
        },
        dragonSlash:{
            learnCost:35,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:165,damagePerLevel:33,spCost:65,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:2,requires:["explosiveFlurry"],
            description:"需先學習火爆亂擊。初次學習需35技能點，對單體造成165點傷害，消耗65 SP；目標死亡或爆擊時免費追擊，最多額外追擊2次。追擊不消耗SP，原目標死亡時自動改選存活敵人。最高5級，每升1級消耗1技能點，傷害+33。"
        },
        fireRocket:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:4,spCost:10,
            burnChance:25,burnDuration:2,burnPercentByLevel:[1,1,2,2,3],
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成13點傷害，消耗10 SP；25%基礎機率燃燒2回合，每回合造成目標最大HP的1%/1%/2%/2%/3%。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        blazeSpell:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:45,damagePerLevel:9,spCost:28,
            burnChance:30,burnDuration:2,burnPercentByLevel:[1,2,3,4,5],requires:["fireRocket"],
            description:"需先學習火箭。初次學習需10技能點，對單體造成45點傷害，消耗28 SP；30%基礎機率燃燒2回合，每回合造成目標最大HP的1%/2%/3%/4%/5%。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        flameTornado:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:150,damagePerLevel:30,spCost:47,
            burnChance:100,guaranteedBurn:true,burnDuration:1,burnPercentByLevel:[3,4,5,6,7],requires:["blazeSpell"],
            description:"需先學習烈火術。初次學習需30技能點，對單一目標造成150點傷害，消耗47 SP；必定燃燒1回合，每回合造成目標最大HP的3%/4%/5%/6%/7%。最高5級，每升1級消耗1技能點，傷害+30。"
        },
        phoenixCry:{
            learnCost:35,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:28,damagePerLevel:6,spCost:60,
            burnChance:40,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],
            burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1,requires:["flameTornado"],
            description:"需先學習烈焰龍捲。初次學習需35技能點，對敵方全體各造成28點傷害，消耗60 SP；各目標有40%基礎機率獲得【燃燒】2回合。每回合燃燒傷害為目標最大HP的5%/7%/9%/11%/13%。本次實際新增燃燒少於3人時，施法者獲得【鳳威】1回合，造成的所有傷害+30%。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        rage:{
            learnCost:25,maxLevel:5,upgradeCost:1,targetType:"allyTri",spCost:50,duration:3,
            critBonusByLevel:[5,10,15,20,25],critChanceBonusByLevel:[5,10,15,20,25],
            critDamageBonusByLevel:[10,20,30,40,50],requires:["explosiveFlurry","flameTornado"],
            description:"需先學習火爆亂擊或烈焰龍捲其一。初次學習需25技能點，提高我方中、左、右3人的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續3回合，消耗50 SP。最高5級，每升1級消耗1技能點。"
        },
        fireEX:{
            learnCost:25,maxLevel:1,targetType:"none",damageBonusPercent:10,critChanceBonusPercent:5,critDamageBonusPercent:5,
            statusTargetDamageBonusPercent:5,
            description:"永久提升火元素傷害10%、爆擊率5%、爆擊傷害5%；對有異常狀態的目標傷害再提升5%。"
        },

        stormFist:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:26,damagePerLevel:6,spCost:7,
            agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1,
            description:"初次學習需2技能點。對單體造成26點傷害，消耗7 SP；50%基礎機率降低目標敏捷30%/40%/50%/60%/70%，持續1回合。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        stormFlurry:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:3,spCost:20,
            damageDownChance:50,damageDownByLevel:[10,20,30,40,50],damageDownDuration:2,requires:["stormFist"],
            description:"需先學習暴風拳。初次學習需10技能點，對同排中、左、右最多3名目標各造成13點傷害，消耗20 SP；50%基礎機率降低目標造成的傷害10%/20%/30%/40%/50%，持續2回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        windCrossSlash:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:39,
            damageDownChance:65,damageDownByLevel:[20,30,35,40,50],damageDownDuration:1,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。初次學習需15技能點，對單體造成128點傷害，消耗39 SP；65%基礎機率降低目標造成的傷害20%/30%/35%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        dizzyFist:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:141,damagePerLevel:29,spCost:55,
            stunChance:65,missBonusByLevel:[30,45,50,55,65],stunDuration:5,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。初次學習需30技能點，對單體造成141點傷害，消耗55 SP；65%基礎機率使目標暈眩5回合，MISS率提高30%/45%/50%/55%/65%。最高5級，每升1級消耗1技能點，傷害+29。"
        },
        windSpell:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:12,damagePerLevel:3,spCost:9,
            agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成12點傷害，消耗9 SP；50%基礎機率降低目標敏捷10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        stormCircle:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:14,damagePerLevel:4,spCost:18,
            damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["windSpell"],
            description:"需先學習狂風術。初次學習需10技能點，對同排中、左、右最多3名目標各造成14點傷害，消耗18 SP；55%基礎機率降低目標造成的傷害15%/18%/21%/25%/30%，持續1回合。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        windHowlLightning:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:55,
            damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormCircle"],
            description:"需先學習風焰術。初次學習需15技能點，對單體造成128點傷害，消耗55 SP；65%基礎機率降低目標造成的傷害15%/20%/25%/30%/35%，持續1回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        stormRain:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:24,damagePerLevel:5,spCost:75,
            stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1,requires:["windHowlLightning"],
            description:"需先學習風哮電擊。初次學習需30技能點，對敵方全體各造成24點傷害，消耗75 SP；35%基礎機率附加【暈眩】1回合，使目標MISS率提高30%/45%/50%/55%/65%。最高5級，每升1級消耗1技能點，傷害+5。"
        },
        dodgeSkill:{
            learnCost:10,maxLevel:1,targetType:"allyTri",spCost:20,duration:3,evasionBonusPercent:75,
            requires:["windCrossSlash","windHowlLightning"],description:"需先學習風旋十字斬或風哮電擊其一。初次學習需10技能點，使我方中、左、右3人閃躲率提升75%，持續3回合，消耗20 SP。最高1級。"
        },
        stealthSkill:{
            learnCost:15,maxLevel:1,targetType:"ally",spCost:45,duration:3,requires:["dodgeSkill"],
            description:"需先學習閃躲術。初次學習需15技能點，使我方1人隱身3回合；期間無法被單體技能選中，但仍會受到範圍技能波及，消耗45 SP。最高1級。"
        },
        dinghaishenzhen:{
            learnCost:20,maxLevel:1,targetType:"allyAll",spCost:77,duration:3,statusResistBonus:65,accuracyBonusPercent:50,
            requires:["stealthSkill"],description:"需先學習隱身術。初次學習需20技能點，使我方全體異常狀態抗性提升65%、命中提升50%，持續3回合，消耗77 SP。最高1級。"
        },
        windEX:{
            learnCost:25,maxLevel:1,targetType:"none",evasionBonusPercent:35,description:"初次學習需25技能點，最大1級；永久提升風元素角色的閃躲率35%。"
        },

        stoneSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:26,damagePerLevel:6,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對單體造成26點傷害，消耗7 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        petrifyFist:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:3,spCost:26,
            selfShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["stoneSlash"],
            description:"需先學習土石斬。初次學習需10技能點，對同排中、左、右最多3名目標各造成13點傷害，消耗26 SP；並使自身獲得100/125/150/175/200點護盾2回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        stoneBreakSky:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:42,
            selfShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["petrifyFist"],
            description:"需先學習石盾拳。初次學習需15技能點，對單體造成128點傷害，消耗42 SP；並使自身獲得100/125/150/175/200點護盾2回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        earthquakeCrush:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:47,damagePerLevel:9,spCost:55,
            petrifyChanceByLevel:[30,35,40,45,50],petrifyDuration:2,requires:["stoneBreakSky"],
            description:"需先學習石破天驚。初次學習需30技能點，對同排中、左、右最多3名目標各造成47點傷害，消耗55 SP；依等級有30%/35%/40%/45%/50%基礎機率石化目標2回合。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        stoneThrow:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:12,damagePerLevel:3,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成12點傷害，消耗7 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        sandWind:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:14,damagePerLevel:4,spCost:19,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,requires:["stoneThrow"],
            description:"需先學習落石術。初次學習需10技能點，對同排中、左、右最多3名目標各造成14點傷害，消耗19 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        flyingSandStrike:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:24,damagePerLevel:5,spCost:55,
            defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35],defenseDownDuration:2,requires:["sandWind"],
            description:"需先學習滾石術。初次學習需15技能點，對敵方全體各造成24點傷害，消耗55 SP；60%基礎機率附加【破防】2回合，降低防禦10%/15%/20%/25%/35%。最高5級，每升1級消耗1技能點，傷害+5。"
        },
        dustStorm:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:140,damagePerLevel:28,spCost:65,
            petrifyChanceByLevel:[20,25,30,35,45],petrifyDuration:2,requires:["flyingSandStrike"],
            description:"需先學習飛沙瞬擊。初次學習需30技能點，對單體造成140點傷害，消耗65 SP；依等級有20%/25%/30%/35%/45%基礎機率石化目標2回合。最高5級，每升1級消耗1技能點，傷害+28。"
        },
        earthShield:{
            learnCost:10,maxLevel:1,targetType:"allyTri",spCost:66,duration:3,reflectPercent:50,
            requires:["stoneBreakSky","flyingSandStrike"],description:"需先學習石破天驚或飛沙瞬擊其一。初次學習需10技能點，使我方中、左、右3人獲得50%反傷土盾，持續3回合，消耗66 SP。最高1級。"
        },
        rockWall:{
            learnCost:15,maxLevel:1,targetType:"allyTri",spCost:45,duration:4,defenseBonusPercent:35,requires:["barrier"],
            description:"需先學習結界。初次學習需15技能點，使我方中、左、右3人防禦力提升35%，持續4回合，消耗45 SP。最高1級。"
        },
        barrier:{
            learnCost:20,maxLevel:1,targetType:"ally",spCost:40,duration:5,barrierBlockCount:5,requires:["earthShield"],
            description:"需先學習萬象土盾。使我方1人獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不抵擋且不消耗次數，消耗40 SP。"
        },
        earthEX:{
            learnCost:25,maxLevel:1,targetType:"none",defenseBonusPercent:35,description:"初次學習需25技能點，最大1級；永久提升土元素角色的防禦力35%。"
        }
    };

    Object.keys(SKILLS).forEach(id=>patchSkill(id,SKILLS[id]));

    const FINAL_FIRE_WIND_EARTH_DAMAGE_SKILL_IDS=[
        "flameSlash","fireCritical","explosiveFlurry","dragonSlash",
        "fireRocket","blazeSpell","flameTornado","phoenixCry",
        "stormFist","stormFlurry","windCrossSlash","dizzyFist",
        "windSpell","stormCircle","windHowlLightning","stormRain","stormSpell",
        "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush",
        "stoneThrow","sandWind","flyingSandStrike","dustStorm"
    ];
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        window.v173ApplyFormalDamageRoleProfiles(FINAL_FIRE_WIND_EARTH_DAMAGE_SKILL_IDS);
    }

    /* ----- Status rules: Frostbite blocks skills only. ----- */
    function activeStatus(entity,type){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type===type&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeBuff(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function partyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>Number.isInteger(index));
        }
        return [0,1,2].filter(index=>typeof getPartyCharacterByIndex==="function"&&getPartyCharacterByIndex(index));
    }

    function livingPartyIndexes(){
        return partyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return character&&numeric(character.hp)>0;
        });
    }

    function livingMonsterIndexes(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.filter(index=>{
            const monster=monsters[index];
            return monster&&monster.alive!==false&&numeric(monster.hp)>0;
        });
    }

    function learnedPartySkill(index,skillId){
        if(typeof getSkillLevel!=="function"){ return false; }
        const key=typeof getPartyCharacterKey==="function"
            ?getPartyCharacterKey(index):(index===0?"fire":"player"+(index+1));
        return numeric(getSkillLevel(key,skillId))>0;
    }

    function applyFrostbite(entity,duration){
        if(!entity){ return false; }
        if(typeof window.v173HasNamedPersistentState==="function"&&window.v173HasNamedPersistentState(entity,"frostbite")){
            return false;
        }
        if(typeof applyMonsterDebuff==="function"){
            return applyMonsterDebuff(entity,"frostbite",Math.max(1,numeric(duration)||2),0)!==false;
        }
        entity.statusEffects=entity.statusEffects||[];
        const entry={type:"frostbite",turnsLeft:duration||2,value:0};
        if(
            typeof getPartyCharacterIndex==="function"&&
            getPartyCharacterIndex(entity)>=0
        ){
            entry.deferFirstTick=true;
        }
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(entry,"frostbite");
        }
        entity.statusEffects.push(entry);
        return true;
    }

    function playFrostbiteEffect(side,index){
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect(side,index,"freeze");
        }
    }

    if(typeof applySkillDebuffEffects==="function"){
        const previousApplySkillDebuffs=applySkillDebuffEffects;
        applySkillDebuffEffects=function(skill,level,monster,index,casterLevel,casterIntelligence){
            const result=previousApplySkillDebuffs.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!monster||!monster.alive){ return result; }
            const args=[
                skill.frostbiteChance,casterLevel,monster.level,casterIntelligence,
                typeof getMonsterEffectiveSpiritPoints==="function"?getMonsterEffectiveSpiritPoints(monster):numeric(monster.spiritPoints),
                false,typeof getMonsterRank==="function"?getMonsterRank(monster):"regular"
            ];
            const roll=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(monster,"frostbite",args,"monster",index,skill.name)
                :{duplicate:false,hit:typeof rollStatusEffectHit==="function"&&rollStatusEffectHit.apply(null,args)};
            if(roll.hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(monster,duration);
                playFrostbiteEffect("monster",index);
                if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"陷入凍傷，"+duration+"回合內無法使用技能。"); }
            }else if(!roll.duplicate&&typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+monster.name+"抵抗了）");
            }
            return result;
        };
    }

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previousApplySkillDebuffsToPlayer=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index,casterLevel,casterIntelligence){
            const result=previousApplySkillDebuffsToPlayer.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!target||numeric(target.hp)<=0){ return result; }
            const spirit=typeof getFinalBattleSpiritForPlayerTarget==="function"
                ?getFinalBattleSpiritForPlayerTarget(target,index):numeric(target.spirit);
            const resist=typeof getPlayerStatusResistBonus==="function"?getPlayerStatusResistBonus(target):0;
            const args=[skill.frostbiteChance,casterLevel,target.level,casterIntelligence,spirit,false,"regular",resist];
            const roll=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(target,"frostbite",args,"player",index,skill.name)
                :{duplicate:false,hit:typeof rollStatusEffectHit==="function"&&rollStatusEffectHit.apply(null,args)};
            if(roll.hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(target,duration);
                playFrostbiteEffect("player",index);
                if(typeof addBattleLog==="function"){ addBattleLog((target.id||"角色")+"陷入凍傷，"+duration+"回合內無法使用技能。"); }
            }else if(!roll.duplicate&&typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+(target.id||"角色")+"抵抗了）");
            }
            return result;
        };
    }

    function tickFrostbite(entity,label){
        if(!entity||!Array.isArray(entity.statusEffects)){ return; }
        entity.statusEffects=entity.statusEffects.filter(effect=>{
            if(!effect||effect.type!=="frostbite"){ return true; }
            if(effect.deferFirstTick){
                effect.deferFirstTick=false;
                return true;
            }
            effect.turnsLeft=numeric(effect.turnsLeft)-1;
            if(effect.turnsLeft<=0&&typeof addBattleLog==="function"){
                addBattleLog(label+"的凍傷效果已解除。");
            }
            return effect.turnsLeft>0;
        });
    }

    if(typeof tickStatusEffects==="function"){
        const previousTickStatusEffects=tickStatusEffects;
        tickStatusEffects=function(){
            const waterEX=typeof skillDatabase!=="undefined"?skillDatabase.waterEX:null;
            const cleanseChance=Math.max(0,numeric(waterEX&&waterEX.turnStartCleanseChance));
            if(cleanseChance>0){
                partyIndexes().forEach(index=>{
                    const character=getPartyCharacterByIndex(index);
                    if(
                        !character||numeric(character.hp)<=0||character.element!=="water"||
                        !Array.isArray(character.statusEffects)||!character.statusEffects.length||
                        !learnedPartySkill(index,"waterEX")||Math.random()*100>=cleanseChance
                    ){ return; }
                    const removed=character.statusEffects.length;
                    character.statusEffects=[];
                    if(typeof addBattleLog==="function"){
                        addBattleLog((character.id||"角色")+"的水元素EX在回合開始前解除"+removed+"個負面狀態。");
                    }
                });
            }
            const result=previousTickStatusEffects.apply(this,arguments);
            livingMonsterIndexes().forEach(index=>tickFrostbite(monsters[index],monsters[index].name));
            partyIndexes().forEach(index=>{
                const character=getPartyCharacterByIndex(index);
                if(character&&numeric(character.hp)>0){ tickFrostbite(character,character.id||"角色"); }
            });
            return result;
        };
    }

    function rejectFrostbittenSkill(character,index,skill,consumeTurn){
        if(!skill||!activeStatus(character,"frostbite")){ return false; }
        if(typeof showMissEffect==="function"){ showMissEffect(true,index,"MISS"); }
        if(typeof addBattleLog==="function"){
            addBattleLog((character.id||"角色")+"處於凍傷狀態，無法使用"+skill.name+"。可改用普通攻擊、補品、符咒、防禦或逃脫。");
        }
        if(consumeTurn&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof prepareAction==="function"){
        const previousPrepareAction=prepareAction;
        prepareAction=function(type){
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[type]:null;
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            if(skill&&rejectFrostbittenSkill(character,index,skill,false)){ return; }
            return previousPrepareAction.apply(this,arguments);
        };
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            const skill=queued&&typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            if(skill&&rejectFrostbittenSkill(character,characterIndex,skill,true)){ return; }
            return previousResolveQueuedAction.apply(this,arguments);
        };
    }

    if(typeof autoActionForCharacter==="function"){
        const previousAutoAction=autoActionForCharacter;
        autoActionForCharacter=function(characterIndex){
            const result=previousAutoAction.apply(this,arguments);
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            if(character&&activeStatus(character,"frostbite")&&queued&&skillDatabase[queued.action]){
                queued.action="normal";
                if(typeof addBattleLog==="function"){
                    addBattleLog((character.id||"角色")+"處於凍傷狀態，自動戰鬥已改用普通攻擊。");
                }
            }
            return result;
        };
    }

    /* ----- Player Fire EX, guaranteed Burn and conditional follow-ups. ----- */
    let playerSkillContext=null;

    function withPlayerSkillContext(context,callback){
        const previousContext=playerSkillContext;
        const previousDamageActor=window.v149CurrentDamageActor;
        playerSkillContext=context;
        window.v149CurrentDamageActor=context&&context.character||null;
        try{ return callback(); }
        finally{
            playerSkillContext=previousContext;
            window.v149CurrentDamageActor=previousDamageActor;
        }
    }

    function withGuaranteedBurn(skill,callback){
        const previousStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
        if(!skill||!skill.guaranteedBurn||!previousStatusRoll){ return callback(); }
        rollStatusEffectHit=function(baseChance){
            if(numeric(baseChance)===numeric(skill.burnChance)){ return true; }
            return previousStatusRoll.apply(this,arguments);
        };
        try{ return callback(); }
        finally{ rollStatusEffectHit=previousStatusRoll; }
    }

    /* Every qualifying Fire physical skill reuses this one owner. */
    function firstLivingMonsterIndex(){
        const indexes=livingMonsterIndexes();
        return indexes.length?indexes[0]:null;
    }

    function preferredLivingMonsterIndex(preferred){
        return Number.isInteger(preferred)&&livingMonsterIndexes().includes(preferred)
            ?preferred:firstLivingMonsterIndex();
    }

    function scheduleAfterAnimation(callback){
        const gate=window.v142SkillAnimationDirector&&window.v142SkillAnimationDirector.getActive
            ?window.v142SkillAnimationDirector.getActive():null;
        if(gate&&gate.promise&&!gate.done){ gate.promise.then(callback); }
        else{ setTimeout(callback,0); }
    }

    function captureBattleFinish(onFinish){
        const flow=window.FourSymbolsBattleFlow;
        if(!flow||typeof flow.interceptActionFinish!=="function"){ return function(){}; }
        return flow.interceptActionFinish(()=>{
            if(typeof onFinish==="function"){ onFinish(); }
            return true;
        });
    }

    function livingMonsterSnapshot(){
        return livingMonsterIndexes().map(index=>({
            index:index,monster:monsters[index],wasAlive:true
        }));
    }

    function snapshotHasDefeat(snapshot){
        return (snapshot||[]).some(entry=>
            entry.wasAlive&&(!entry.monster||entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        );
    }

    function invokeTrackedPlayerSkill(options,freeCast){
        const snapshot=livingMonsterSnapshot();
        const originalCost=options.skill.spCost;
        const hadFreeFlag=Object.prototype.hasOwnProperty.call(options.skill,"v149FreeFollowUp");
        const originalFreeFlag=options.skill.v149FreeFollowUp;
        const originalRoll=typeof rollCritical==="function"?rollCritical:null;
        let finishRequested=false;
        let critical=false;
        let result;

        if(freeCast){
            options.skill.spCost=0;
            options.skill.v149FreeFollowUp=true;
        }
        const releaseFinishCapture=options.realFinish
            ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
        if(originalRoll){
            rollCritical=function(){
                const roll=originalRoll.apply(this,arguments);
                if(roll&&roll.isCrit){ critical=true; }
                return roll;
            };
        }
        try{
            result=withPlayerSkillContext(options.context,()=>
                withGuaranteedBurn(options.skill,()=>options.previous.apply(options.that,options.args))
            );
        }finally{
            if(originalRoll){ rollCritical=originalRoll; }
            releaseFinishCapture();
            options.skill.spCost=originalCost;
            if(hadFreeFlag){ options.skill.v149FreeFollowUp=originalFreeFlag; }
            else{ delete options.skill.v149FreeFollowUp; }
        }
        return {
            result:result,finishRequested:finishRequested,critical:critical,
            defeated:snapshotHasDefeat(snapshot)
        };
    }

    function runPlayerFollowUp(options,castNumber){
        scheduleAfterAnimation(()=>{
            const nextTarget=preferredLivingMonsterIndex(options.originalTarget);
            if(nextTarget===null||typeof battleActive!=="undefined"&&!battleActive){
                if(options.realFinish){ options.realFinish(); }
                return;
            }

            const repeatArgs=options.args.slice();
            if(Number.isInteger(options.centerArgIndex)){ repeatArgs[options.centerArgIndex]=nextTarget; }
            if(typeof selectedMonster!=="undefined"){ selectedMonster=nextTarget; }
            let outcome;
            try{
                outcome=invokeTrackedPlayerSkill(Object.assign({},options,{args:repeatArgs}),true);
            }catch(error){
                console.error(options.skill.name+"追擊施放失敗：",error);
                if(options.realFinish){ options.realFinish(); }
                return;
            }
            if(
                outcome.finishRequested&&castNumber<numeric(options.skill.followUpMaxCasts)&&
                (outcome.critical||outcome.defeated)&&
                preferredLivingMonsterIndex(options.originalTarget)!==null
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog(options.skill.name+"追擊出現爆擊或擊敗目標，再追擊一次！");
                }
                runPlayerFollowUp(options,castNumber+1);
                return;
            }
            if(outcome.finishRequested&&options.realFinish){ options.realFinish(); }
        });
    }

    function wrapPlayerSkillCast(name,skillArgIndex,centerArgIndex,characterIndexFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[args[skillArgIndex]]:null;
            const characterIndex=characterIndexFromArgs(args);
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const context={skill:skill,character:character,characterIndex:characterIndex};
            if(!skill||!skill.followUpOnCriticalOrDefeat){
                const that=this;
                return withPlayerSkillContext(context,()=>withGuaranteedBurn(skill,()=>previous.apply(that,args)));
            }
            const originalTarget=Number.isInteger(centerArgIndex)&&Number.isInteger(args[centerArgIndex])
                ?args[centerArgIndex]
                :(typeof selectedMonster!=="undefined"&&Number.isInteger(selectedMonster)?selectedMonster:null);
            const beforeSp=numeric(character&&character.sp);
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            const options={
                previous:previous,that:this,args:args,skill:skill,context:context,
                centerArgIndex:centerArgIndex,originalTarget:originalTarget,realFinish:realFinish
            };
            const outcome=invokeTrackedPlayerSkill(options,false);
            const spent=beforeSp-numeric(character&&character.sp)>=numeric(skill.spCost);
            const target=preferredLivingMonsterIndex(originalTarget);
            const follow=outcome.finishRequested&&spent&&target!==null&&(outcome.critical||outcome.defeated);
            if(!follow){
                if(outcome.finishRequested&&realFinish){ realFinish(); }
                return outcome.result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog(skill.name+"觸發追擊！"); }
            runPlayerFollowUp(options,1);
            return outcome.result;
        };
    }

    wrapPlayerSkillCast("castDamageSkill",0,null,()=>0);
    wrapPlayerSkillCast("castSecondaryCharacterSkill",1,2,args=>Number(args[0])||0);
    wrapPlayerSkillCast("castPlayer2Skill",0,1,()=>1);

    /* ----- Barrier corners, revived brightness and rank colours. ----- */
    function barrierState(entity){
        const buff=entity&&Array.isArray(entity.activeBuffs)?entity.activeBuffs.find(item=>
            item&&item.type==="barrier"&&numeric(item.turnsLeft)>0&&numeric(item.remainingBlocks)>0
        ):null;
        if(buff){ return buff; }
        const shield=entity&&entity.v141Shield;
        return shield&&shield.isBarrier&&numeric(shield.turnsLeft)>0&&numeric(shield.remainingBlocks)>0?shield:null;
    }

    function syncBarrierCard(card,entity){
        if(!card){ return; }
        card.classList.toggle("v149-has-barrier",!!barrierState(entity));
    }

                            function rankFor(monster){
        const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster&&monster.v141BattleRank);
        return rank==="boss"?"boss":rank==="elite"?"elite":"regular";
    }

    function syncMonsterCard(index){
        if(typeof document==="undefined"||typeof monsters==="undefined"){ return; }
        const monster=monsters[index];
        const card=document.getElementById("battleMonster"+index);
        if(!card||!monster){ return; }
        card.dataset.rank=rankFor(monster);
        const alive=monster.alive!==false&&numeric(monster.hp)>0;
        card.classList.toggle("v149-living-monster",alive);
        if(alive){
            card.classList.remove("dead","dying","v146-defeated");
            card.style.removeProperty("opacity");
            card.style.removeProperty("filter");
            card.style.removeProperty("pointer-events");
        }
        syncBarrierCard(card,monster);
    }

    function syncPlayerCards(){
        if(typeof document==="undefined"){ return; }
        partyIndexes().forEach(index=>syncBarrierCard(
            document.getElementById("battlePlayerCard"+index),getPartyCharacterByIndex(index)
        ));
    }

    function syncAllCombatCards(){
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach((monster,index)=>{ if(monster){ syncMonsterCard(index); } });
        }
        syncPlayerCards();
    }

    if(typeof window.v143SyncEarthShieldEffects==="function"){
        const previousEarthShieldSync=window.v143SyncEarthShieldEffects;
        window.v143SyncEarthShieldEffects=function(){
            const result=previousEarthShieldSync.apply(this,arguments);
            syncAllCombatCards();
            return result;
        };
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousPlayCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index,type){
            if(side==="monster"&&type==="revive"){ syncMonsterCard(index); }
            const result=previousPlayCardEffect.apply(this,arguments);
            setTimeout(syncAllCombatCards,0);
            if(side==="monster"&&type==="revive"){ setTimeout(()=>syncMonsterCard(index),1900); }
            return result;
        };
    }

    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncMonsterCard(index);
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncAllCombatCards();
            return result;
        };
    }

    /* ----- Reflect damage label and monster Frostbite/Fire follow-ups. ----- */
    let currentReflectAttacker=null;

    function showReflectDamage(index,amount){
        if(typeof document==="undefined"||amount<=0){ return; }
        const card=document.getElementById("battleMonster"+index);
        if(!card){ return; }
        const popup=document.createElement("strong");
        popup.className="v149-reflect-popup";
        popup.textContent="反傷HP-"+Math.floor(amount);
        card.appendChild(popup);
        setTimeout(()=>popup.remove(),1350);
    }
    window.v149ShowReflectDamage=showReflectDamage;

    if(typeof addBattleLog==="function"){
        const previousAddBattleLog=addBattleLog;
        addBattleLog=function(message){
            const text=String(message||"");
            const match=text.match(/(?:反傷造成.*?|萬象土盾反彈)(\d+)點傷害/);
            if(match&&Number.isInteger(currentReflectAttacker)){
                showReflectDamage(currentReflectAttacker,numeric(match[1]));
            }
            return previousAddBattleLog.apply(this,arguments);
        };
    }

    function runMonsterFollowUp(options,castNumber){
        scheduleAfterAnimation(()=>{
            const monster=options.monster;
            if(!monster||monster.alive===false||numeric(monster.hp)<=0||!livingPartyIndexes().length){
                if(options.realFinish){ options.realFinish(); }
                return;
            }

            const originalCost=options.skill.spCost;
            const originalIds=monster.skillIds;
            const originalSupports=monster.v141SupportSkillIds;
            const originalChance=monster.skillChance;
            const originalHit=typeof showPlayerHit==="function"?showPlayerHit:null;
            const originalLog=typeof addBattleLog==="function"?addBattleLog:null;
            const originalStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
            const previousRepeatAttacker=currentReflectAttacker;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),
                alive:numeric(getPartyCharacterByIndex(index)&&getPartyCharacterByIndex(index).hp)>0
            }));
            let finishRequested=false;
            let repeatedCritical=false;
            let failed=false;

            options.skill.spCost=0;
            monster.skillIds=[options.skill.id];
            monster.v141SupportSkillIds=[];
            monster.skillChance=1;
            currentReflectAttacker=options.monsterIndex;
            const releaseFinishCapture=options.realFinish
                ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
            if(originalHit){
                showPlayerHit=function(){
                    if(arguments[4]===true){ repeatedCritical=true; }
                    return originalHit.apply(this,arguments);
                };
            }
            if(originalLog){
                addBattleLog=function(message){
                    if(String(message||"").includes(options.skill.name)&&String(message||"").includes("（爆擊！）")){
                        repeatedCritical=true;
                    }
                    return originalLog.apply(this,arguments);
                };
            }
            if(originalStatusRoll&&options.skill.guaranteedBurn){
                rollStatusEffectHit=function(baseChance){
                    if(numeric(baseChance)===numeric(options.skill.burnChance)){ return true; }
                    return originalStatusRoll.apply(this,arguments);
                };
            }
            const previousDamageActor=window.v149CurrentDamageActor;
            window.v149CurrentDamageActor=monster;
            try{
                if(typeof window.v155WithForcedFinalAbyssSkillLevel==="function"){
                    window.v155WithForcedFinalAbyssSkillLevel(monster,()=>
                        options.previous.apply(options.that,options.attackArgs)
                    );
                }else{
                    options.previous.apply(options.that,options.attackArgs);
                }
            }
            catch(error){
                failed=true;
                console.error("敵方"+options.skill.name+"追擊施放失敗：",error);
            }
            finally{
                releaseFinishCapture();
                if(originalHit){ showPlayerHit=originalHit; }
                if(originalLog){ addBattleLog=originalLog; }
                if(originalStatusRoll){ rollStatusEffectHit=originalStatusRoll; }
                currentReflectAttacker=previousRepeatAttacker;
                window.v149CurrentDamageActor=previousDamageActor;
                options.skill.spCost=originalCost;
                monster.skillIds=originalIds;
                monster.v141SupportSkillIds=originalSupports;
                monster.skillChance=originalChance;
            }

            if(failed){
                if(options.realFinish){ options.realFinish(); }
                return;
            }
            const defeatedTarget=livingBefore.some(entry=>
                entry.alive&&(!entry.character||numeric(entry.character.hp)<=0)
            );
            if(
                finishRequested&&castNumber<numeric(options.skill.followUpMaxCasts)&&
                (repeatedCritical||defeatedTarget)&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingPartyIndexes().length
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog(monster.name+"的"+options.skill.name+"追擊出現爆擊或擊敗目標，再追擊一次！");
                }
                runMonsterFollowUp(options,castNumber+1);
                return;
            }
            if(finishRequested&&options.realFinish){ options.realFinish(); }
        });
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const attackArgs=Array.prototype.slice.call(arguments);
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const frostbitten=activeStatus(monster,"frostbite");
            const saved=monster?{
                skillIds:monster.skillIds,supports:monster.v141SupportSkillIds,skillChance:monster.skillChance
            }:null;
            if(frostbitten&&monster){
                monster.skillIds=[];
                monster.v141SupportSkillIds=[];
                monster.skillChance=0;
            }
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            const previousHit=typeof showPlayerHit==="function"?showPlayerHit:null;
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            const previousStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),alive:true
            }));
            let finishRequested=false;
            let castSkillId=null;
            let critical=false;
            const releaseFinishCapture=realFinish
                ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(typeof skillDatabase!=="undefined"){
                        castSkillId=Object.keys(skillDatabase).find(id=>skillDatabase[id]&&skillDatabase[id].name===name)||null;
                    }
                    return previousBadge.apply(this,arguments);
                };
            }
            if(previousHit){
                showPlayerHit=function(){
                    if(arguments[4]===true){ critical=true; }
                    return previousHit.apply(this,arguments);
                };
            }
            if(previousLog){
                addBattleLog=function(message){
                    const text=String(message||"");
                    const skill=castSkillId&&typeof skillDatabase!=="undefined"?skillDatabase[castSkillId]:null;
                    if(skill&&text.includes(skill.name)&&text.includes("（爆擊！）")){ critical=true; }
                    return previousLog.apply(this,arguments);
                };
            }
            if(previousStatusRoll){
                rollStatusEffectHit=function(baseChance){
                    const skill=castSkillId&&typeof skillDatabase!=="undefined"?skillDatabase[castSkillId]:null;
                    if(skill&&skill.guaranteedBurn&&numeric(baseChance)===numeric(skill.burnChance)){ return true; }
                    return previousStatusRoll.apply(this,arguments);
                };
            }
            const previousAttacker=currentReflectAttacker;
            const previousDamageActor=window.v149CurrentDamageActor;
            currentReflectAttacker=monsterIndex;
            window.v149CurrentDamageActor=monster;
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{
                currentReflectAttacker=previousAttacker;
                window.v149CurrentDamageActor=previousDamageActor;
                releaseFinishCapture();
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(previousHit){ showPlayerHit=previousHit; }
                if(previousLog){ addBattleLog=previousLog; }
                if(previousStatusRoll){ rollStatusEffectHit=previousStatusRoll; }
                if(frostbitten&&monster){
                    monster.skillIds=saved.skillIds;
                    monster.v141SupportSkillIds=saved.supports;
                    monster.skillChance=saved.skillChance;
                }
            }
            const repeatSkill=castSkillId&&skillDatabase[castSkillId];
            const livingTargets=livingPartyIndexes();
            const defeatedTarget=livingBefore.some(entry=>
                entry.alive&&(!entry.character||numeric(entry.character.hp)<=0)
            );
            const repeat=finishRequested&&repeatSkill&&repeatSkill.followUpOnCriticalOrDefeat&&monster&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingTargets.length&&
                (critical||defeatedTarget);
            if(!repeat){
                if(finishRequested&&realFinish){ realFinish(); }
                return result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"的"+repeatSkill.name+"觸發追擊！"); }
            runMonsterFollowUp({
                previous:previousMonsterAttack,that:this,attackArgs:attackArgs,
                monster:monster,monsterIndex:monsterIndex,skill:repeatSkill,realFinish:realFinish
            },1);
            return result;
        };
    }

    /* ----- Procedural word-circle fallback retired; V143 raster owner is authoritative. ----- */

    function refreshSkillText(){
        try{
            if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
            if(typeof document!=="undefined"){
                document.querySelectorAll(".creation-skill-chip[data-skill-id]").forEach(chip=>{
                    const skill=skillDatabase[chip.dataset.skillId];
                    if(skill){ chip.title=skill.description||skill.name; }
                });
            }
        }catch(error){ console.error("V149 更新技能顯示失敗：",error); }
    }

    function boot(){
        syncAllCombatCards();
        refreshSkillText();
        if(typeof document!=="undefined"){
            const homeShop=document.getElementById("homeIconShop");
            if(homeShop){ homeShop.style.backgroundImage="url(assets/ui/home-shop.png)"; }
        }
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        let queued=false;
        const observer=new MutationObserver(()=>{
            if(queued){ return; }
            queued=true;
            requestAnimationFrame(()=>{ queued=false; syncAllCombatCards(); });
        });
        const observe=()=>observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",observe,{once:true}); }
        else{ observe(); }
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v149SyncCombatCards=syncAllCombatCards;
    window.v149Diagnostics=function(){
        return {
            version:VERSION,skillCount:Object.keys(SKILLS).length,frostbiteBlocksSkillsOnly:true,
            sameNameStateMiss:true,barrierCornerCount:false,proceduralSkillFallback:false,
            mainShopIcon:"assets/ui/home-shop.png",navShopIcon:"assets/ui/home-shop-v147.png"
        };
    };
})();


/* bundled source: js/44-v152-dev-fixes.js */
/* =====================================================
   V152 — current dev fixes and final requested values
===================================================== */
(function installV152DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v152DevFixesInstalled){ return; }
    window.__v152DevFixesInstalled=true;

    const VERSION="152";
    const ABYSS_PORTRAITS={
        東帝:"assets/dungeons/abyss/east-emperor.webp",
        天帝:"assets/dungeons/abyss/heaven-emperor.webp",
        北帝:"assets/dungeons/abyss/north-emperor.webp",
        南帝:"assets/dungeons/abyss/south-emperor.webp",
        天兵天將:"assets/dungeons/abyss/soldier.webp"
    };

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level)||1)-1));
        return numeric(values[index]);
    }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{
            skillDatabase[id][key]=Array.isArray(fields[key])?fields[key].slice():fields[key];
        });
    }

    patchSkill("yuanXiangGuangMing",{
        targetType:"allyAll",baseHeal:150,baseHealSP:55,
        description:"我方全體回復150 HP、55 SP。"
    });
    patchSkill("yuanGuangShield",{
        targetType:"allyAll",shieldAmount:100,shieldDuration:2,
        description:"我方全體獲得100護盾，持續2回合。"
    });
    patchSkill("yuanZuBlessing",{
        targetType:"allyAll",cleanseChance:20,agilityBonusPercent:50,duration:2,
        description:"對我方全體施放祝福，有20%機率解除所有負面狀態，並增加敏捷50%，持續2回合。"
    });

    function cleanAccidentalFireSkill(){
        if(typeof skillDatabase!=="undefined"){ delete skillDatabase.fireBurstStrike; }
        if(typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts){
            Object.keys(characterSkillLoadouts).forEach(key=>{
                const loadout=characterSkillLoadouts[key];
                if(!loadout){ return; }
                if(loadout.skillLevels){ delete loadout.skillLevels.fireBurstStrike; }
                if(Array.isArray(loadout.equippedSkills)){
                    loadout.equippedSkills=loadout.equippedSkills.filter(id=>id!=="fireBurstStrike");
                }
            });
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyAutoConfig==="function"){
            getExistingPartyIndexes().forEach(index=>{
                const config=getPartyAutoConfig(index);
                if(config&&config.skill==="fireBurstStrike"){ config.skill="normal"; }
            });
        }
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(monster=>{
                if(!monster){ return; }
                if(Array.isArray(monster.skillIds)){
                    monster.skillIds=monster.skillIds.map(id=>id==="fireBurstStrike"?"fireCritical":id);
                }
                if(Array.isArray(monster.v141SupportSkillIds)){
                    monster.v141SupportSkillIds=monster.v141SupportSkillIds.filter(id=>id!=="fireBurstStrike");
                }
            });
        }
    }
    cleanAccidentalFireSkill();

    function syncSkillPointDisplay(){
        if(typeof document==="undefined"){ return; }
        const node=document.getElementById("skillPoints");
        if(!node){ return; }
        const owner=typeof getSkillCharacterObject==="function"&&typeof currentSkillCharacter!=="undefined"
            ?getSkillCharacterObject(currentSkillCharacter):null;
        node.textContent=String(Math.max(0,Math.floor(numeric(owner&&owner.skillPoints))));
    }

    if(typeof renderSkillLoadout==="function"){
        const previousRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const result=previousRenderSkillLoadout.apply(this,arguments);
            syncSkillPointDisplay();
            return result;
        };
    }

    function partySkillLevel(characterIndex,skillId){
        if(typeof getSkillLevel!=="function"){ return 1; }
        const key=typeof getPartyCharacterKey==="function"
            ?getPartyCharacterKey(characterIndex):(characterIndex===0?"fire":"player"+(characterIndex+1));
        return Math.max(1,Math.min(5,Math.floor(numeric(getSkillLevel(key,skillId))||1)));
    }

    function rageLevelFor(character,buff){
        if(buff&&numeric(buff.skillLevel)>0){ return numeric(buff.skillLevel); }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const index=getExistingPartyIndexes().find(item=>getPartyCharacterByIndex(item)===character);
            if(Number.isInteger(index)){ return partySkillLevel(index,"rage"); }
        }
        return Math.max(1,numeric(character&&(character.v141ForceSkillLevel||character.v141SkillLevel))||1);
    }

    function normalizeRageBuff(character){
        const buff=character&&Array.isArray(character.activeBuffs)
            ?character.activeBuffs.find(item=>item&&item.type==="rage"&&numeric(item.turnsLeft)>0):null;
        if(!buff){ return null; }
        const level=rageLevelFor(character,buff);
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.rage:null;
        const chance=levelValue(skill&&(skill.critChanceBonusByLevel||skill.critBonusByLevel),level,0);
        const damage=levelValue(skill&&(skill.critDamageBonusByLevel||skill.critBonusByLevel),level,0);
        buff.bonusPercent=chance;
        buff.critChanceBonusPercent=chance;
        buff.critDamageBonusPercent=damage;
        buff.skillLevel=level;
        return buff;
    }

    if(typeof rollCritical==="function"){
        const previousRollCritical=rollCritical;
        rollCritical=function(character){
            normalizeRageBuff(character);
            return previousRollCritical.apply(this,arguments);
        };
    }

    function currentAbyssEntries(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>
            entry.monster&&entry.monster.alive!==false&&numeric(entry.monster.hp)>0
        );
    }

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return Math.max(0,numeric(monster&&monster.hp)-(shield?numeric(shield.remaining):0));
    }

    function monsterBaseMaxHp(monster){
        return Math.max(0,numeric(monster&&monster.v141Shield&&monster.v141Shield.baseMaxHP)||numeric(monster&&monster.maxHP));
    }

    function restoreMonsterSp(monster,amount){
        const before=Math.max(0,numeric(monster&&monster.sp));
        const max=Math.max(before,numeric(monster&&monster.maxSP));
        monster.sp=Math.min(max,before+Math.max(0,numeric(amount)));
        return monster.sp-before;
    }

    function applyExtremeBlessing(monster){
        if(!monster||monster.alive===false){ return; }
        let blessing=monster.v142AgilityBlessing;
        if(!blessing){
            const original=Math.max(0,numeric(monster.agility));
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2};
            blessing={originalAgility:original,turnsLeft:2,displayBuff:display};
            monster.v142AgilityBlessing=blessing;
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }
        blessing.turnsLeft=2;
        blessing.displayBuff.turnsLeft=2;
        monster.agility=Math.round(numeric(blessing.originalAgility)*1.5);
    }

    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||monster.alive===false||numeric(monster.hp)<=0||monster.name!=="極帝天尊"){ return false; }
        monster.v141AbyssAi="v152-support";
        monster.v141SupportSkillIds=Array.from(new Set((monster.v141SupportSkillIds||[]).concat([
            "yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"
        ])));
        if((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||
           (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))){ return false; }

        const allies=currentAbyssEntries();
        if(!allies.length){ return false; }
        const hasNegative=allies.some(entry=>Array.isArray(entry.monster.statusEffects)&&entry.monster.statusEffects.length>0);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        const needsShield=allies.some(entry=>!(entry.monster.v141Shield&&numeric(entry.monster.v141Shield.remaining)>0));
        const needsBlessing=allies.some(entry=>!(entry.monster.v142AgilityBlessing&&numeric(entry.monster.v142AgilityBlessing.turnsLeft)>0));
        const skillId=forcedSkillId||(hasNegative?"yuanZuBlessing":needsHeal?"yuanXiangGuangMing":
            needsShield?"yuanGuangShield":needsBlessing?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }

        if(skillId==="yuanXiangGuangMing"){
            let hpTotal=0;
            let spTotal=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,150):(function(){
                        const before=numeric(ally.hp);
                        ally.hp=Math.min(numeric(ally.maxHP),before+150);
                        return ally.hp-before;
                    })();
                const restored=restoreMonsterSp(ally,55);
                hpTotal+=healed;
                spTotal+=restored;
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元相光明：我方全體回復150 HP、55 SP（實際 "+hpTotal+" HP／"+spTotal+" SP）。");
            }
        }else if(skillId==="yuanGuangShield"){
            allies.forEach(entry=>{
                if(typeof window.v141ApplyMonsterShield==="function"){
                    window.v141ApplyMonsterShield(entry.monster,100,2);
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元光護體：我方全體獲得100護盾，持續2回合。");
            }
        }else if(skillId==="yuanZuBlessing"){
            const cleansed=forcedCleanse===undefined?Math.random()*100<20:!!forcedCleanse;
            let removed=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                if(cleansed&&Array.isArray(ally.statusEffects)){
                    removed+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                applyExtremeBlessing(ally);
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元祖賜福：我方全體敏捷提升50%，持續2回合；"+
                    (cleansed?"並解除"+removed+"個負面狀態。":"本次未觸發負面狀態解除。"));
            }
        }else{
            return false;
        }

        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&monster.name==="極帝天尊"){
                return resolveExtremeEmperorAction(monsterIndex);
            }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function hasFrostbite(character){
        return !!(character&&Array.isArray(character.statusEffects)&&character.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeBattleCharacter(){
        const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
        return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
    }

    function syncFrostbiteSkillControls(){
        if(typeof document==="undefined"){ return; }
        const blocked=hasFrostbite(activeBattleCharacter());
        const mainButton=document.querySelector&&document.querySelector("#mainBattleMenu > .menu-button.skill");
        if(mainButton){
            if(blocked){
                mainButton.disabled=true;
                mainButton.dataset.v152FrostbiteBlocked="1";
                mainButton.classList.add("v152-frostbite-blocked");
                mainButton.setAttribute("aria-label","凍傷禁止使用技能");
            }else if(mainButton.dataset.v152FrostbiteBlocked==="1"){
                mainButton.disabled=false;
                delete mainButton.dataset.v152FrostbiteBlocked;
                mainButton.classList.remove("v152-frostbite-blocked");
                mainButton.setAttribute("aria-label","技能");
            }
        }
        if(document.querySelectorAll){
            document.querySelectorAll(".v152-frostbite-symbol").forEach(symbol=>symbol.remove());
        }
        if(!blocked||!document.querySelectorAll){ return; }
        document.querySelectorAll("#skillQuickBarGrid .skill-quick-button").forEach(button=>{
            button.disabled=true;
            button.onclick=null;
            button.classList.add("v152-frostbite-blocked");
        });
    }

    if(typeof populateSkillQuickBar==="function"){
        const previousPopulateSkillQuickBar=populateSkillQuickBar;
        populateSkillQuickBar=function(){
            const result=previousPopulateSkillQuickBar.apply(this,arguments);
            syncFrostbiteSkillControls();
            return result;
        };
    }
    if(typeof toggleSkillQuickBar==="function"){
        const previousToggleSkillQuickBar=toggleSkillQuickBar;
        toggleSkillQuickBar=function(){
            if(hasFrostbite(activeBattleCharacter())){
                syncFrostbiteSkillControls();
                return;
            }
            return previousToggleSkillQuickBar.apply(this,arguments);
        };
    }

    if(typeof showDamagePopup==="function"){
        const previousShowDamagePopup=showDamagePopup;
        showDamagePopup=function(element){
            const result=previousShowDamagePopup.apply(this,arguments);
            if(!element||typeof document==="undefined"||!document.body||!element.querySelectorAll){ return result; }
            const popups=element.querySelectorAll(":scope > .damage-popup.hp-popup");
            const popup=popups.length?popups[popups.length-1]:null;
            if(!popup||typeof element.getBoundingClientRect!=="function"){ return result; }
            const rect=element.getBoundingClientRect();
            const visualScale=Math.max(.8,Math.min(3,rect.width/Math.max(1,numeric(element.offsetWidth)||rect.width)));
            popup.classList.add("v152-top-damage");
            popup.style.setProperty("left",(rect.left+rect.width/2)+"px","important");
            popup.style.setProperty("top",(rect.top+rect.height*.26)+"px","important");
            popup.style.setProperty("font-size",Math.round(18*visualScale)+"px","important");
            document.body.appendChild(popup);
            return result;
        };
    }

    function dismissRewardToast(toast){
        if(!toast){ return; }
        if(toast._hideTimer){ clearTimeout(toast._hideTimer); }
        toast.classList.remove("show");
    }

    function removeTaskTracker(){
        if(typeof document==="undefined"){ return; }
        const tracker=document.getElementById("v141TaskTracker");
        if(tracker){ tracker.remove(); }
    }

    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("click",event=>{
            const toast=event.target&&event.target.closest?event.target.closest("#v141RewardToast"):null;
            if(toast){ dismissRewardToast(toast); }
        },true);
    }

    function anyAutoRecoveryEnabled(){
        if(typeof getExistingPartyIndexes!=="function"||typeof getPartyAutoConfig!=="function"){ return false; }
        return getExistingPartyIndexes().some(index=>{
            const config=getPartyAutoConfig(index);
            return !!(config&&config.enabled);
        });
    }

    let lastAutoRecoveryAt=-Infinity;
    if(typeof applyPostBattleAutoRecovery==="function"){
        const previousAutoRecovery=applyPostBattleAutoRecovery;
        applyPostBattleAutoRecovery=function(){
            const result=previousAutoRecovery.apply(this,arguments);
            lastAutoRecoveryAt=Date.now();
            return result;
        };
    }

    function recoverOnMapEntry(){
        if(
            typeof battleActive!=="undefined"&&battleActive||
            !anyAutoRecoveryEnabled()||
            typeof applyPostBattleAutoRecovery!=="function"||
            Date.now()-lastAutoRecoveryAt<5000
        ){ return false; }
        applyPostBattleAutoRecovery();
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        return true;
    }

    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const target=typeof document!=="undefined"?document.getElementById(page+"Page"):null;
            const wasActive=!!(target&&target.classList.contains("active"));
            const result=previousShowPage.apply(this,arguments);
            const entered=target&&target.classList.contains("active")&&!wasActive;
            if(entered&&page==="map"){ recoverOnMapEntry(); }
            return result;
        };
    }

    if(typeof enterMap==="function"){
        const previousEnterMap=enterMap;
        enterMap=function(){
            const result=previousEnterMap.apply(this,arguments);
            recoverOnMapEntry();
            return result;
        };
    }

    ["v141StartAbyss","v141ResetAbyss"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            recoverOnMapEntry();
            return result;
        };
    });

    if(typeof switchDungeonTab==="function"){
        const previousSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(tabName){
            const result=previousSwitchDungeonTab.apply(this,arguments);
            if(tabName==="abyss"&&typeof document!=="undefined"&&document.getElementById("v141AbyssMap")){
                recoverOnMapEntry();
            }
            return result;
        };
    }

    function currentRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>entry.monster);
    }

    function syncAbyssBattleUi(){
        if(typeof document==="undefined"){ return; }
        const roster=currentRoster();
        const abyss=roster.some(entry=>entry.monster.v141Abyss);
        const battlePage=document.getElementById("battlePage");
        if(battlePage){ battlePage.classList.toggle("v152-abyss-battle",abyss); }
        const info=document.getElementById("battleInfo");
        if(abyss&&info){ info.hidden=false; info.removeAttribute("hidden"); }

        const earlyAbyss=abyss&&roster.length<=5&&!roster.some(entry=>entry.monster.name==="極帝天尊");
        roster.forEach(entry=>{
            const card=document.getElementById("battleMonster"+entry.index);
            if(!card){ return; }
            const portrait=earlyAbyss?ABYSS_PORTRAITS[entry.monster.name]:null;
            card.classList.toggle("v152-abyss-portrait",!!portrait);
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
            }
        });
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            syncAbyssBattleUi();
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncAbyssBattleUi();
            return result;
        };
    }
    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncSkillPointDisplay();
            syncFrostbiteSkillControls();
            syncAbyssBattleUi();
            return result;
        };
    }

    function boot(){
        cleanAccidentalFireSkill();
        syncSkillPointDisplay();
        syncFrostbiteSkillControls();
        syncAbyssBattleUi();
        removeTaskTracker();
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        const beginObserve=()=>{
            if(!document.body){ return; }
            const observer=new MutationObserver(()=>removeTaskTracker());
            observer.observe(document.body,{childList:true,subtree:true});
        };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",beginObserve,{once:true}); }
        else{ beginObserve(); }
    }
    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v152SyncSkillPointDisplay=syncSkillPointDisplay;
    window.v152NormalizeRageBuff=normalizeRageBuff;
    window.v152ResolveExtremeEmperorAction=resolveExtremeEmperorAction;
    window.v152SyncFrostbiteSkillControls=syncFrostbiteSkillControls;
    window.v152SyncAbyssBattleUi=syncAbyssBattleUi;
    window.v152Diagnostics=function(){
        return {
            version:VERSION,independentSkillPointDisplay:true,removedFireBurstStrike:!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike),
            rageAppliedByCriticalResolver:true,damagePopupAboveVfx:true,taskTrackerRemoved:true,
            autoRecoveryOnMapEntry:true,abyssBattleInfo:true,abyssPortraits:true
        };
    };
})();


/* bundled source: js/45-v154-dev-fixes.js */
/* =====================================================
   V154 — current dev battle, element box and monster portrait fixes
===================================================== */
(function installV154DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v154DevFixesInstalled){ return; }
    window.__v154DevFixesInstalled=true;

    const MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json";
    const HEAVENLY_SOLDIER_ELEMENTS=new Set(["fire","water","wind","earth"]);
    const TEMPORARY_MONSTER_PORTRAIT="assets/dungeons/abyss/soldier.webp";
    const TEMPORARY_BOSS_PORTRAIT="assets/monsters/boss/boss-placeholder-fire-demon.webp";
    const EARLY_ABYSS_PORTRAITS={
        東帝:"assets/dungeons/abyss/east-emperor.webp",
        天帝:"assets/dungeons/abyss/heaven-emperor.webp",
        北帝:"assets/dungeons/abyss/north-emperor.webp",
        南帝:"assets/dungeons/abyss/south-emperor.webp",
        天兵天將:"assets/dungeons/abyss/soldier.webp"
    };
    const FINAL_ABYSS_PORTRAITS={
        東帝天尊:"assets/dungeons/abyss/floor5-east-emperor.webp",
        天帝天尊:"assets/dungeons/abyss/floor5-heaven-emperor.webp",
        北帝天尊:"assets/dungeons/abyss/floor5-north-emperor.webp",
        南帝天尊:"assets/dungeons/abyss/floor5-south-emperor.webp",
        極帝天尊:"assets/dungeons/abyss/floor5-extreme-emperor.webp",
        天兵天將:"assets/dungeons/abyss/floor5-soldier.webp"
    };
    let monsterPortraitRegistry=null;
    let monsterPortraitRegistryPromise=null;
    let monsterPortraitByKey=new Map();
    let monsterPortraitByUniqueName=new Map();

    function currentAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters
            .map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.v141Abyss);
    }

    function isFinalAbyssRoster(roster){
        return roster.some(entry=>Object.prototype.hasOwnProperty.call(
            FINAL_ABYSS_PORTRAITS,
            entry.monster.name
        )&&entry.monster.name!=="天兵天將");
    }

    function registryTargets(registry){
        if(!registry||!registry.groups||!Array.isArray(registry.tupleSchema)){ return []; }
        const fields=registry.tupleSchema;
        return Object.entries(registry.groups).flatMap(([group,rows])=>(rows||[]).map(row=>{
            const target={group:group};
            fields.forEach((field,index)=>{ target[field]=row[index]; });
            return target;
        }));
    }

    function installMonsterPortraitRegistry(registry){
        const byKey=new Map();
        const byName=new Map();
        const duplicateNames=new Set();
        registryTargets(registry).forEach(target=>{
            if(target.status!=="existing"||!target.portraitKey||!target.path){ return; }
            byKey.set(target.portraitKey,target);
            if(byName.has(target.name)){ duplicateNames.add(target.name); }
            else{ byName.set(target.name,target); }
        });
        duplicateNames.forEach(name=>byName.delete(name));
        monsterPortraitRegistry=registry;
        monsterPortraitByKey=byKey;
        monsterPortraitByUniqueName=byName;
        syncMonsterPortraits();
        return registry;
    }
    window.v154InstallMonsterPortraitRegistry=installMonsterPortraitRegistry;

    function requestMonsterPortraitRegistry(){
        if(monsterPortraitRegistryPromise||typeof fetch!=="function"){ return monsterPortraitRegistryPromise; }
        monsterPortraitRegistryPromise=fetch(MONSTER_PORTRAIT_REGISTRY_URL,{cache:"no-cache"})
            .then(response=>{
                if(!response||!response.ok){ throw new Error("HTTP "+(response&&response.status)); }
                return response.json();
            })
            .then(installMonsterPortraitRegistry)
            .catch(error=>{
                console.warn("[monster-portrait] registry load failed; existing battle art remains active.",error);
                return null;
            });
        return monsterPortraitRegistryPromise;
    }
    window.v154RequestMonsterPortraitRegistry=requestMonsterPortraitRegistry;

    function legacyAbyssPortrait(monster,finalFloor){
        if(!monster||!monster.v141Abyss){ return null; }
        const portraits=finalFloor?FINAL_ABYSS_PORTRAITS:EARLY_ABYSS_PORTRAITS;
        return portraits[monster.name]||null;
    }

    function resolveMonsterPortraitRecord(monster,options){
        if(!monster){ return null; }
        const dedicatedPath=String(monster.vGameplayPortrait||"").trim();
        if(dedicatedPath){
            return {
                portraitKey:"gameplay.object."+String(monster.objectType||monster.name||"unit"),
                name:monster.name||"",
                element:monster.element||"dynamic",
                rank:monster.rank||"regular",
                sizeClass:monster.unitKind==="boss"?"boss":"regular",
                path:dedicatedPath,
                status:"existing",
                dedicated:true
            };
        }
        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss"||(monster.v141Abyss===true&&monster.name!=="天兵天將"&&(Object.prototype.hasOwnProperty.call(EARLY_ABYSS_PORTRAITS,monster.name)||Object.prototype.hasOwnProperty.call(FINAL_ABYSS_PORTRAITS,monster.name)));
        return {
            portraitKey:temporaryBoss?"temporary.boss-reference":"temporary.heavenly-soldier",
            name:monster.name||"",
            element:monster.element||"dynamic",
            rank:temporaryBoss?"boss":(monster.rank||"regular"),
            sizeClass:temporaryBoss?"boss":"regular",
            path:temporaryBoss?TEMPORARY_BOSS_PORTRAIT:TEMPORARY_MONSTER_PORTRAIT,
            status:"existing",
            temporary:true
        };
        /* Dedicated registry resolution is intentionally retained below for the
           later removal of this temporary all-monster presentation switch. */
        const explicitKey=String(monster.portraitKey||monster.monsterPortraitKey||"").trim();
        if(explicitKey&&monsterPortraitByKey.has(explicitKey)){
            return monsterPortraitByKey.get(explicitKey);
        }
        if(monster.name==="天兵天將"){
            const element=String(monster.portraitElement||monster.element||"").toLowerCase();
            if(HEAVENLY_SOLDIER_ELEMENTS.has(element)){
                const soldier=monsterPortraitByKey.get("soldier."+element);
                if(soldier){ return soldier; }
            }
        }
        const byName=monsterPortraitByUniqueName.get(monster.name);
        if(byName){ return byName; }
        const legacy=legacyAbyssPortrait(monster,!!(options&&options.finalAbyss));
        return legacy?{
            portraitKey:"legacy.abyss."+String(monster.name||"unknown"),
            name:monster.name,
            element:monster.element||"dynamic",
            rank:monster.rank||"regular",
            sizeClass:"boss",
            path:legacy,
            status:"existing",
            legacy:true
        }:null;
    }
    window.v154ResolveMonsterPortraitRecord=resolveMonsterPortraitRecord;
    window.resolveMonsterPortrait=function(monster){
        const roster=currentAbyssRoster();
        const record=resolveMonsterPortraitRecord(monster,{finalAbyss:isFinalAbyssRoster(roster)});
        return record?record.path:null;
    };

    function installMonsterPortraitPresentationStyle(){
        /* Portrait selection belongs here; portrait geometry does not. V174 owns
           the shared no-crop presentation contract for players, monsters and bosses. */
        return;
    }

    function syncMonsterPortraitArt(card,portrait){
        if(!card){ return; }
        const selector=".v162-abyss-battle-portrait-art";
        const art=typeof card.querySelector==="function"?card.querySelector(selector):null;
        if(!portrait){
            if(art&&typeof art.remove==="function"){ art.remove(); }
            else if(art&&art.parentNode&&typeof art.parentNode.removeChild==="function"){
                art.parentNode.removeChild(art);
            }
            return;
        }
        let portraitArt=art;
        if(!portraitArt&&typeof document.createElement==="function"){
            portraitArt=document.createElement("img");
            portraitArt.className="v162-abyss-battle-portrait-art v154-monster-portrait-art";
            portraitArt.alt="";
            portraitArt.draggable=false;
            portraitArt.decoding="async";
            portraitArt.setAttribute("aria-hidden","true");
            if(card.firstChild&&typeof card.insertBefore==="function"){
                card.insertBefore(portraitArt,card.firstChild);
            }else if(typeof card.appendChild==="function"){
                card.appendChild(portraitArt);
            }
        }
        if(portraitArt&&portraitArt.dataset.monsterPortraitSrc!==portrait){
            portraitArt.src=portrait;
            portraitArt.dataset.monsterPortraitSrc=portrait;
            portraitArt.dataset.abyssPortraitSrc=portrait;
        }
    }

    function syncCardlessPresentation(card,record){
        if(!card){ return; }
        const previousManaged=!!card.dataset.monsterPortraitKey;
        const art=typeof card.querySelector==="function"?card.querySelector(".v174-battle-art"):null;
        if(record){
            const cssValue='url("'+record.path+'")';
            if(!previousManaged&&card.dataset.v174BattleArtwork){
                card.dataset.v154BaseBattleArtwork=card.dataset.v174BattleArtwork;
            }
            card.dataset.v174BattleArtwork=cssValue;
            if(art&&art.style){ art.style.backgroundImage=cssValue; }
            return;
        }
        if(!previousManaged){ return; }
        const base=card.dataset.v154BaseBattleArtwork||"";
        if(base){ card.dataset.v174BattleArtwork=base; }
        else{ delete card.dataset.v174BattleArtwork; }
        delete card.dataset.v154BaseBattleArtwork;
        if(art&&art.style){
            if(base){ art.style.backgroundImage=base; }
            else if(typeof art.style.removeProperty==="function"){ art.style.removeProperty("background-image"); }
            else{ art.style.backgroundImage=""; }
        }
    }

    function syncMonsterPortraits(){
        if(typeof document==="undefined"){ return; }
        installMonsterPortraitPresentationStyle();
        const roster=currentAbyssRoster();
        const finalFloor=isFinalAbyssRoster(roster);
        const battlePage=document.getElementById("battlePage");
        if(battlePage){
            battlePage.classList.toggle("v154-abyss-battle",roster.length>0);
            battlePage.classList.toggle("v154-abyss-final",finalFloor);
        }

        if(typeof currentBattleMonsters==="undefined"){ return; }
        currentBattleMonsters.forEach(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const card=document.getElementById("battleMonster"+index);
            if(!card){ return; }
            const record=resolveMonsterPortraitRecord(monster,{finalAbyss:finalFloor});
            const portrait=record&&record.path;
            const abyssPortrait=!!(portrait&&monster&&monster.v141Abyss);
            syncCardlessPresentation(card,record);
            card.classList.toggle("v152-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-monster-portrait",!!portrait);
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
                card.dataset.monsterPortraitKey=record.portraitKey;
                card.dataset.monsterPortraitPath=portrait;
                if(abyssPortrait){ card.dataset.abyssPortrait=finalFloor?"floor5":"floor1-4"; }
                else{ delete card.dataset.abyssPortrait; }
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
                delete card.dataset.monsterPortraitKey;
                delete card.dataset.monsterPortraitPath;
                delete card.dataset.abyssPortrait;
            }
            syncMonsterPortraitArt(card,portrait);
        });
    }
    window.v154SyncMonsterPortraits=syncMonsterPortraits;
    window.v154SyncAbyssPortraits=syncMonsterPortraits;

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            syncMonsterPortraits();
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncMonsterPortraits();
            return result;
        };
    }

    function isElementBoxRecoveryActive(){
        if(typeof window.v131GetElementBoxState==="function"){
            try{
                const state=window.v131GetElementBoxState();
                return !!(state&&state.active);
            }catch(_){ }
        }
        return typeof autoBattle!=="undefined"&&!!autoBattle;
    }

    function showElementBoxUseNotice(message){
        if(typeof document==="undefined"){ return; }
        const host=document.getElementById("game-stage")||document.body;
        if(!host){ return; }
        let stack=document.getElementById("v17342ElementBoxNoticeStack");
        if(!stack){
            stack=document.createElement("div");
            stack.id="v17342ElementBoxNoticeStack";
            stack.className="v17342-element-box-notice-stack";
            stack.setAttribute("aria-live","polite");
            stack.setAttribute("aria-atomic","false");
            host.appendChild(stack);
        }
        const notice=document.createElement("div");
        notice.className="v17342-element-box-use-notice";
        notice.textContent=String(message||"");
        stack.appendChild(notice);
        while(stack.children&&stack.children.length>6){
            const oldest=stack.firstElementChild;
            if(!oldest||oldest===notice){ break; }
            oldest.remove();
        }
        const setNoticeVisible=visible=>{
            if(!notice.classList){ return; }
            if(typeof notice.classList.toggle==="function"){
                notice.classList.toggle("show",!!visible);
                return;
            }
            const method=visible?"add":"remove";
            if(typeof notice.classList[method]==="function"){
                notice.classList[method]("show");
            }
        };
        const revealNotice=()=>setNoticeVisible(true);
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(revealNotice); }
        else{ revealNotice(); }
        if(typeof setTimeout==="function"){
            setTimeout(()=>{
                setNoticeVisible(false);
                setTimeout(()=>{
                    if(notice.parentNode&&typeof notice.remove==="function"){ notice.remove(); }
                    const childCount=Number.isFinite(Number(stack&&stack.childElementCount))
                        ?Number(stack.childElementCount)
                        :(stack&&Array.isArray(stack.children)?stack.children.length:1);
                    if(stack&&childCount===0&&stack.parentNode&&typeof stack.remove==="function"){ stack.remove(); }
                },180);
            },3000);
        }
    }
    window.v17342ShowElementBoxUseNotice=showElementBoxUseNotice;

    function logElementBoxRecovery(message,noticeOnly){
        const text=String(message||"");
        if(!text){ return; }
        if(noticeOnly){
            showElementBoxUseNotice(text);
            return;
        }
        if(typeof addBattleLog==="function"){ addBattleLog(text); }
        if(!(typeof battleActive!=="undefined"&&battleActive)&&typeof window!=="undefined"){
            window.v17342PendingBattleNotices=Array.isArray(window.v17342PendingBattleNotices)
                ?window.v17342PendingBattleNotices:[];
            window.v17342PendingBattleNotices.push(text);
            if(window.v17342PendingBattleNotices.length>12){ window.v17342PendingBattleNotices.shift(); }
        }
    }

    function finishAutoRecovery(){
        if(
            typeof getExistingPartyIndexes!=="function"||
            typeof getPartyCharacterByIndex!=="function"||
            typeof getPartyAutoConfig!=="function"||
            typeof getPartyBattleStats!=="function"
        ){ return 0; }
        let consumed=0;
        let shouldReturnToCity=false;
        const elementBoxActive=isElementBoxRecoveryActive();
        const entries=getExistingPartyIndexes().map(characterIndex=>{
            const entry={
                characterIndex:characterIndex,
                character:getPartyCharacterByIndex(characterIndex),
                config:getPartyAutoConfig(characterIndex),
                stats:getPartyBattleStats(characterIndex)
            };
            if(
                !entry.character||entry.character.hp<=0||!entry.config||!entry.stats||
                (!entry.config.enabled&&!elementBoxActive)
            ){ return null; }
            return entry;
        }).filter(Boolean);

        ["hp","sp"].forEach(resource=>{
            let pending=entries.slice();
            let guard=0;
            while(pending.length&&guard++<Math.max(100,entries.length*100)){
                let progressed=false;
                const next=[];
                pending.forEach(entry=>{
                    const character=entry.character;
                    const config=entry.config;
                    const stats=entry.stats;
                    const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
                    const threshold=normalizeAutoBattleThreshold(
                        config[resource],
                        resource==="hp"?50:25
                    );
                    const currentValue=Number(character[resource])||0;
                    if(maxValue<=0||currentValue>=maxValue||currentValue/maxValue*100>threshold){ return; }
                    const potionId=getAutoPotionId(resource);
                    const definition=getPotionDefinition(potionId);
                    if(!definition||!consumePotionFromInventory(potionId,1)){
                        if(config.returnToCityWhenEmpty){ shouldReturnToCity=true; }
                        return;
                    }
                    const planned=definition.recoveryPercent>=100
                        ?maxValue-currentValue
                        :Math.max(1,Math.round(maxValue*definition.recoveryPercent/100));
                    const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));
                    character[resource]=Math.min(maxValue,currentValue+recovered);
                    consumed++;
                    progressed=true;
                    logElementBoxRecovery(
                        "["+(character.id||"角色")+"使用補品 恢復"+recovered+resource.toUpperCase()+"]",
                        true
                    );
                    const updatedValue=Number(character[resource])||0;
                    if(recovered>0&&updatedValue<maxValue&&updatedValue/maxValue*100<=threshold){
                        next.push(entry);
                    }
                });
                pending=next;
                if(!progressed){ break; }
            }
        });
        if(consumed&&typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(shouldReturnToCity&&elementBoxActive){
            const emptyPotionMessage="元素匣偵測到補品不足，已停止巡練並返回主城。";
            logElementBoxRecovery(emptyPotionMessage);
            if(typeof window.v169StopElementBox==="function"){ window.v169StopElementBox(); }
            else if(typeof toggleAutoBattle==="function"&&typeof autoBattle!=="undefined"&&autoBattle){ toggleAutoBattle(); }
            if(typeof showPage==="function"){ showPage("home"); }
            if(typeof window.rpgAlert==="function"){
                void window.rpgAlert(
                    "自動補品已用完，元素匣已停止巡練並返回主城。\n請補充補品後，再重新啟動元素匣。",
                    {title:"補品不足",confirmText:"知道了",danger:true}
                );
            }else if(typeof alert==="function"){
                alert(emptyPotionMessage);
            }
        }
        return consumed;
    }
    window.v154FinishAutoRecovery=finishAutoRecovery;
    window.v154IsElementBoxRecoveryActive=isElementBoxRecoveryActive;

    if(typeof applyPostBattleAutoRecovery==="function"){
        const previousAutoRecovery=applyPostBattleAutoRecovery;
        applyPostBattleAutoRecovery=function(){
            const result=previousAutoRecovery.apply(this,arguments);
            finishAutoRecovery();
            return result;
        };
    }

    function syncElementBoxPrimaryButton(){
        if(typeof document==="undefined"){ return; }
        const button=document.getElementById("autoBattleButton");
        if(!button){ return; }
        button.setAttribute("onclick","v154UseElementBoxPrimaryAction()");
        const active=typeof autoBattle!=="undefined"&&autoBattle;
        button.textContent=active?"⏹ 停止":"套用並啟動";
        button.classList.toggle("active",active);
    }

    function setElementBoxSettingsLayer(active){
        if(typeof document==="undefined"||!document.body||!document.body.classList){ return; }
        document.body.classList.toggle("v162-element-box-settings-open",!!active);
    }

    if(typeof openHomeFeature==="function"){
        const previousOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=previousOpenHomeFeature.apply(this,arguments);
            setElementBoxSettingsLayer(type==="autoBattleSettings");
            return result;
        };
    }
    if(typeof closeHomeFeature==="function"){
        const previousCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const result=previousCloseHomeFeature.apply(this,arguments);
            setElementBoxSettingsLayer(false);
            return result;
        };
    }
    window.v154UseElementBoxPrimaryAction=function(){
        if(typeof autoBattle!=="undefined"&&autoBattle){
            return typeof toggleAutoBattle==="function"?toggleAutoBattle():undefined;
        }
        return typeof confirmAutoBattleSettings==="function"?confirmAutoBattleSettings():undefined;
    };

    if(typeof updateAutoButton==="function"){
        const previousUpdateAutoButton=updateAutoButton;
        updateAutoButton=function(){
            const result=previousUpdateAutoButton.apply(this,arguments);
            syncElementBoxPrimaryButton();
            return result;
        };
    }
    if(typeof openAutoBattleSettings==="function"){
        const previousOpenAutoBattleSettings=openAutoBattleSettings;
        openAutoBattleSettings=function(){
            const result=previousOpenAutoBattleSettings.apply(this,arguments);
            syncElementBoxPrimaryButton();
            setElementBoxSettingsLayer(true);
            return result;
        };
    }
    if(typeof closeAutoBattleSettings==="function"){
        const previousCloseAutoBattleSettings=closeAutoBattleSettings;
        closeAutoBattleSettings=function(){
            const result=previousCloseAutoBattleSettings.apply(this,arguments);
            setElementBoxSettingsLayer(false);
            return result;
        };
    }
    if(typeof setTimeout==="function"){
        setTimeout(()=>{
            if(
                isElementBoxRecoveryActive()&&
                !(typeof battleActive!=="undefined"&&battleActive)
            ){
                const consumed=finishAutoRecovery();
                if(consumed&&typeof updateUI==="function"){ updateUI(); }
                if(consumed&&typeof saveGame==="function"){ saveGame(); }
            }
        },0);
    }
    if(typeof setInterval==="function"){
        setInterval(()=>{
            if(
                isElementBoxRecoveryActive()&&
                !(typeof battleActive!=="undefined"&&battleActive)
            ){
                const consumed=finishAutoRecovery();
                if(consumed&&typeof updateUI==="function"){ updateUI(); }
                if(consumed&&typeof saveGame==="function"){ saveGame(); }
            }
        },1000);
    }
    syncElementBoxPrimaryButton();
    requestMonsterPortraitRegistry();
    syncMonsterPortraits();
})();


/* bundled source: js/46-v155-dev-fixes.js */
/* =====================================================
   V155 — hard-control pacing, final Abyss skills and fire ultimates
===================================================== */
(function installV155DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v155DevFixesInstalled){ return; }
    window.__v155DevFixesInstalled=true;

    const VERSION="155";
    const HARD_CONTROL_SKIP_MS=300;
    const FINAL_BOSS_ORDER=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const FINAL_BOSS_RULES={
        東帝天尊:{element:"earth",skills:["dustStorm","stoneBreakSky"],supports:["earthShield"]},
        天帝天尊:{element:"wind",skills:["windHowlLightning","stormRain"],supports:["dinghaishenzhen"]},
        極帝天尊:{element:"light",skills:[],supports:["yuanZuBlessing"]},
        北帝天尊:{element:"water",skills:["iceArrowRain"],supports:["revive","healSpell"]},
        南帝天尊:{element:"fire",skills:["dragonSlash","flameTornado"],supports:["rage"]}
    };
    const FINAL_ELITE_RULES=[
        {element:"water",skills:[],supports:["healSpell"]},
        {element:"earth",skills:["stoneBreakSky"],supports:[]},
        {element:"fire",skills:["flameTornado"],supports:[]},
        {element:"wind",skills:[],supports:["dodgeSkill"]},
        {element:"water",skills:[],supports:["healSpell"]}
    ];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        return numeric(values[Math.min(values.length-1,Math.max(0,Math.floor(numeric(level)||1)-1))]);
    }

    function copyValue(value){ return Array.isArray(value)?value.slice():value; }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    patchSkill("yuanXiangGuangMing",{
        targetType:"allyAll",baseHeal:150,baseHealSP:55,
        description:"我方全體回復150 HP、55 SP。"
    });
    patchSkill("yuanGuangShield",{
        targetType:"allyAll",shieldAmount:100,shieldDuration:2,
        description:"我方全體獲得100護盾，持續2回合。"
    });
    patchSkill("yuanZuBlessing",{
        targetType:"allyAll",baseHeal:100,baseHealSP:100,
        cleanseChance:35,evasionBonusPercent:35,
        duration:2,
        description:"對我方全體施放祝福，每個目標獨立有35%機率解除身上負面狀態，恢復100 HP、100 SP，並增加閃避35%，持續2回合。"
    });
    if(typeof skillDatabase!=="undefined"&&skillDatabase.yuanZuBlessing){
        delete skillDatabase.yuanZuBlessing.agilityBonusPercent;
    }

    function installMonsterOnlyFireBurst(){
        if(typeof skillDatabase==="undefined"||!skillDatabase.fireCritical){ return; }
        const skill=Object.assign({},skillDatabase.fireCritical,{
            id:"fireBurstStrike",name:"火爆一擊",monsterOnly:true
        });
        try{
            Object.defineProperty(skillDatabase,"fireBurstStrike",{
                value:skill,writable:true,configurable:true,enumerable:false
            });
        }catch(_){ skillDatabase.fireBurstStrike=skill; }
}
    installMonsterOnlyFireBurst();

    function rosterMonsters(roster){
        if(!Array.isArray(roster)){ return []; }
        return roster.map(item=>{
            if(item&&typeof item==="object"){ return item; }
            return typeof monsters!=="undefined"?monsters[item]:null;
        }).filter(Boolean);
    }

    function isFinalAbyssRoster(roster){
        const entries=rosterMonsters(roster);
        return FINAL_BOSS_ORDER.every(name=>entries.some(monster=>monster.v141Abyss&&monster.name===name))&&
            entries.filter(monster=>monster.v141Abyss&&monster.name==="天兵天將").length>=5;
    }

    function patchFinalAbyssRoster(roster){
        if(!isFinalAbyssRoster(roster)){ return roster; }
        const entries=rosterMonsters(roster);
        const bosses=FINAL_BOSS_ORDER.map(name=>entries.find(monster=>monster.v141Abyss&&monster.name===name));
        const elites=entries.filter(monster=>monster.v141Abyss&&monster.name==="天兵天將").slice(0,5);

        bosses.forEach((monster,position)=>{
            const rule=FINAL_BOSS_RULES[monster.name];
            monster.element=rule.element;
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=5;
            monster.v141SkillLevel=5;
            monster.v144SkillLevel=5;
            monster.v141FormationRow=0;
            monster.v141FormationPosition=position;
            monster.skillChance=monster.name==="極帝天尊"?1:.78;
            monster.v141AbyssAi=monster.name==="極帝天尊"?"v155-support":"v155-combat";
            monster.v155FinalAbyss=true;
        });
        elites.forEach((monster,position)=>{
            const rule=FINAL_ELITE_RULES[position];
            monster.name="天兵天將";
            monster.element=rule.element;
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=5;
            monster.v141SkillLevel=5;
            monster.v144SkillLevel=5;
            monster.v141FormationRow=1;
            monster.v141FormationPosition=position;
            monster.skillChance=.78;
            monster.v141AbyssAi="v155-combat";
            monster.v155FinalAbyss=true;
        });
        if(roster.every(item=>item&&typeof item==="object")&&roster.length===10){
            roster.splice(0,roster.length,...bosses,...elites);
        }
        roster.v155FinalAbyss=true;
        return roster;
    }
    window.v155PatchFinalAbyssRoster=patchFinalAbyssRoster;

    if(typeof window.v144PatchFinalAbyssRoster==="function"){
        const previousPatchFinalAbyssRoster=window.v144PatchFinalAbyssRoster;
        window.v144PatchFinalAbyssRoster=function(roster){
            const result=previousPatchFinalAbyssRoster.apply(this,arguments);
            return patchFinalAbyssRoster(result||roster);
        };
    }

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(roster){
            patchFinalAbyssRoster(roster);
            const result=previousLaunchDungeonBattle.apply(this,arguments);
            patchFinalAbyssRoster(roster);
            return result;
        };
    }

    function patchCurrentFinalAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return; }
        patchFinalAbyssRoster(currentBattleMonsters.map(index=>monsters[index]));
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            patchCurrentFinalAbyssRoster();
            const result=previousRenderBattle.apply(this,arguments);
            patchCurrentFinalAbyssRoster();
            return result;
        };
    }

    function hardControlled(character){
        return !!(character&&(
            (typeof isMonsterFrozen==="function"&&isMonsterFrozen(character))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(character))
        ));
    }

    function withForcedFinalAbyssSkillLevel(monster,callback){
        const forced=Math.max(1,Math.floor(numeric(monster&&monster.v141ForceSkillLevel)||1));
        if(!monster||!monster.v155FinalAbyss||typeof skillDatabase==="undefined"){
            return callback();
        }
        const ids=Array.from(new Set((monster.skillIds||[]).concat(monster.v141SupportSkillIds||[])));
        const backups=[];
        ids.forEach(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return; }
            const level=Math.min(forced,Math.max(1,Math.floor(numeric(skill.maxLevel)||1)));
            const backup={skill:skill,fields:{}};
            function save(key){
                if(Object.prototype.hasOwnProperty.call(skill,key)&&!Object.prototype.hasOwnProperty.call(backup.fields,key)){
                    backup.fields[key]=skill[key];
                }
            }
            save("maxLevel");
            skill.maxLevel=1;
            [
                ["baseDamage","damagePerLevel"],
                ["powerMultiplier","powerPerLevel"],
                ["flatDamage","flatDamagePerLevel"],
                ["baseHeal","healPerLevel"],
                ["baseHealSP","healSPPerLevel"]
            ]
                .forEach(keys=>{
                    const baseKey=keys[0],perKey=keys[1];
                    if(!Object.prototype.hasOwnProperty.call(skill,baseKey)){ return; }
                    save(baseKey); save(perKey);
                    skill[baseKey]=numeric(skill[baseKey])+numeric(skill[perKey])*(level-1);
                    if(Object.prototype.hasOwnProperty.call(skill,perKey)){ skill[perKey]=0; }
                });
            Object.keys(skill).forEach(key=>{
                if(!/ByLevel$/.test(key)||!Array.isArray(skill[key])||!skill[key].length){ return; }
                save(key);
                const value=skill[key][Math.min(skill[key].length-1,level-1)];
                skill[key]=[value];
            });
            backups.push(backup);
        });
        try{ return callback(); }
        finally{
            backups.forEach(backup=>{
                Object.keys(backup.fields).forEach(key=>{ backup.skill[key]=backup.fields[key]; });
            });
        }
    }
    window.v155WithForcedFinalAbyssSkillLevel=withForcedFinalAbyssSkillLevel;

    function withHardControlDelay(callback){
        const hadOverride=Object.prototype.hasOwnProperty.call(window,"__battleAdvanceDelayOverrideMs");
        const previousOverride=window.__battleAdvanceDelayOverrideMs;
        window.__battleAdvanceDelayOverrideMs=HARD_CONTROL_SKIP_MS;
        try{ return callback(); }
        finally{
            if(hadOverride){ window.__battleAdvanceDelayOverrideMs=previousOverride; }
            else{ delete window.__battleAdvanceDelayOverrideMs; }
        }
    }

    if(typeof beginCharacterTurn==="function"){
        const previousBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(){
            const character=typeof activeBattleCharacterIndex!=="undefined"&&typeof getPartyCharacterByIndex==="function"
                ?getPartyCharacterByIndex(activeBattleCharacterIndex):null;
            if(typeof battlePhase!=="undefined"&&battlePhase==="declare"&&hardControlled(character)){
                const that=this,args=arguments;
                return withHardControlDelay(()=>previousBeginCharacterTurn.apply(that,args));
            }
            return previousBeginCharacterTurn.apply(this,arguments);
        };
    }

    function currentRound(){ return typeof turn!=="undefined"?Math.max(0,numeric(turn)):0; }
    function currentBattleToken(){ return typeof battleToken!=="undefined"?battleToken:null; }

    function currentAbyssEntries(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>
            entry.monster&&entry.monster.alive!==false&&numeric(entry.monster.hp)>0
        );
    }

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return Math.max(0,numeric(monster&&monster.hp)-(shield?numeric(shield.remaining):0));
    }

    function monsterBaseMaxHp(monster){
        return Math.max(0,numeric(monster&&monster.v141Shield&&monster.v141Shield.baseMaxHP)||numeric(monster&&monster.maxHP));
    }

    function restoreMonsterSp(monster,amount){
        const before=Math.max(0,numeric(monster&&monster.sp));
        const max=Math.max(before,numeric(monster&&monster.maxSP));
        monster.sp=Math.min(max,before+Math.max(0,numeric(amount)));
        return monster.sp-before;
    }

    function restoreMonsterHp(monster,amount){
        if(!monster||monster.alive===false){ return 0; }
        if(typeof window.v141HealMonsterPreservingShield==="function"){
            return window.v141HealMonsterPreservingShield(monster,amount);
        }
        const shield=monster.v141Shield;
        const shieldAmount=shield?Math.max(0,numeric(shield.remaining)):0;
        const before=Math.max(0,numeric(monster.hp)-shieldAmount);
        const max=Math.max(before,monsterBaseMaxHp(monster));
        const after=Math.min(max,before+Math.max(0,numeric(amount)));
        monster.hp=after+shieldAmount;
        return after-before;
    }

    function removeDisplayBuff(monster,display){
        if(!monster||!display){ return; }
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==display);
    }

    function clearOldAgilityBlessing(monster){
        const blessing=monster&&monster.v142AgilityBlessing;
        if(!blessing){ return; }
        monster.agility=numeric(blessing.originalAgility);
        removeDisplayBuff(monster,blessing.displayBuff);
        delete monster.v142AgilityBlessing;
    }

    function combineEvasion(sources){
        if(typeof window.v173CombineEvasionRates==="function"){
            return window.v173CombineEvasionRates(sources);
        }
        const remaining=(sources||[]).reduce((chance,source)=>
            chance*(1-Math.max(0,Math.min(100,numeric(source)))/100),1
        );
        return Math.min(85,(1-remaining)*100);
    }

    function ensureV155EvasionBase(monster){
        if(!Object.prototype.hasOwnProperty.call(monster,"v155EvasionBase")){
            monster.v155EvasionBase=numeric(monster.evasion);
        }
        return numeric(monster.v155EvasionBase);
    }

    function recomputeV155Evasion(monster){
        if(!monster){ return; }
        const sources=[];
        if(monster.v155EvasionBlessing){ sources.push(numeric(monster.v155EvasionBlessing.bonusPercent)); }
        if(monster.v155WindDodge){ sources.push(numeric(monster.v155WindDodge.bonusPercent)); }
        if(!sources.length){
            if(Object.prototype.hasOwnProperty.call(monster,"v155EvasionBase")){
                monster.evasion=numeric(monster.v155EvasionBase);
                delete monster.v155EvasionBase;
            }
            return;
        }
        monster.evasion=combineEvasion([ensureV155EvasionBase(monster)].concat(sources));
    }

    function applyEvasionBlessing(monster,bonusPercent,duration){
        if(!monster||monster.alive===false){ return false; }
        const bonus=Math.max(0,numeric(bonusPercent));
        const turns=Math.max(1,Math.floor(numeric(duration)||1));
        const existing=monster.v155EvasionBlessing;
        if(
            existing&&existing.battleToken===currentBattleToken()&&
            currentRound()<numeric(existing.expiresTurn)
        ){
            if(typeof window.v173CanApplyNamedPersistentState==="function"){
                window.v173CanApplyNamedPersistentState(
                    monster,"元祖賜福","monster",
                    typeof monsters!=="undefined"?monsters.indexOf(monster):undefined,
                    "元祖賜福"
                );
            }
            return false;
        }
        clearOldAgilityBlessing(monster);
        const display={
            type:"v141TeamBuff",v141BuffType:"dodge",statusName:"元祖賜福",turnsLeft:turns
        };
        const blessing={
            type:"v141TeamBuff",statusName:"元祖賜福",turnsLeft:turns,
            originalEvasion:ensureV155EvasionBase(monster),bonusPercent:bonus,displayBuff:display,
            battleToken:currentBattleToken(),expiresTurn:currentRound()+turns
        };
        monster.v155EvasionBlessing=blessing;
        monster.activeBuffs=monster.activeBuffs||[];
        monster.activeBuffs.push(display);
        recomputeV155Evasion(monster);
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(blessing,"元祖賜福");
            window.v173MarkPersistentStateName(display,"元祖賜福");
        }
        return true;
    }

    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||monster.name!=="極帝天尊"||monster.alive===false||numeric(monster.hp)<=0||hardControlled(monster)){
            return false;
        }
        monster.v141AbyssAi="v155-support";
        const allies=currentAbyssEntries();
        if(!allies.length){ return false; }
        const hasNegative=allies.some(entry=>Array.isArray(entry.monster.statusEffects)&&entry.monster.statusEffects.length>0);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        const needsBlessing=allies.some(entry=>!(entry.monster.v155EvasionBlessing&&
            entry.monster.v155EvasionBlessing.battleToken===currentBattleToken()&&
            currentRound()<numeric(entry.monster.v155EvasionBlessing.expiresTurn)));
        const skillId=forcedSkillId||((hasNegative||needsHeal||needsBlessing)?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(skillId!=="yuanZuBlessing"||!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }
        if(skillId==="yuanZuBlessing"){
            let removed=0;
            let cleansedTargets=0;
            let blessedTargets=0;
            let healedTotal=0;
            let restoredSpTotal=0;
            allies.forEach((entry,index)=>{
                const ally=entry.monster;
                if(applyEvasionBlessing(ally,skill.evasionBonusPercent,skill.duration)){ blessedTargets++; }
                const healed=restoreMonsterHp(ally,skill.baseHeal);
                const restored=restoreMonsterSp(ally,skill.baseHealSP);
                healedTotal+=healed;
                restoredSpTotal+=restored;
                const cleansed=forcedCleanse===undefined
                    ?Math.random()*100<numeric(skill.cleanseChance)
                    :Array.isArray(forcedCleanse)
                    ?!!forcedCleanse[index]
                    :!!forcedCleanse;
                if(cleansed&&Array.isArray(ally.statusEffects)){
                    cleansedTargets++;
                    removed+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog("極帝天尊施放元祖賜福：全體各恢復100 HP、100 SP（實際 "+healedTotal+" HP／"+
                    restoredSpTotal+" SP）；"+blessedTargets+"名友方獲得閃避提升35%，持續2回合；"+
                    cleansedTargets+"名目標觸發35%獨立淨化，共解除"+removed+"個負面狀態。");
            }
        }else{ return false; }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveExtremeEmperorAction=resolveExtremeEmperorAction;

    function supportCastAllowed(monster,forceCast){
        const chance=monster&&monster.skillChance!==undefined?numeric(monster.skillChance):.55;
        return forceCast===true||Math.random()<=chance;
    }

    function currentAbyssEntriesIncludingDefeated(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>!!entry.monster);
    }

    function allyTriTargets(monsterIndex){
        const living=currentAbyssEntries();
        return typeof window.v141GetMonsterAllyTriTargets==="function"
            ?window.v141GetMonsterAllyTriTargets(monsterIndex,living)
            :living.slice(0,3);
    }

    function hasNamedState(monster,stateName){
        if(typeof window.v173HasNamedPersistentState==="function"){
            return window.v173HasNamedPersistentState(monster,stateName);
        }
        return (monster&&((monster.activeBuffs||[]).concat(monster.v141TeamBuffs||[]))).some(buff=>
            buff&&numeric(buff.turnsLeft)>0&&(
                buff.statusName===stateName||buff.type===stateName||buff.v141BuffType===stateName
            )
        );
    }

    function markNamedState(entry,stateName){
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(entry,stateName);
        }else if(entry){
            entry.statusName={earthShield:"萬象土盾",dinghaishenzhen:"氣定神閒",dodgeSkill:"風行"}[stateName]||stateName;
        }
    }

    function canApplyNamedState(monster,stateName,index,sourceName){
        return typeof window.v173CanApplyNamedPersistentState==="function"
            ?window.v173CanApplyNamedPersistentState(monster,stateName,"monster",index,sourceName)
            :!hasNamedState(monster,stateName);
    }

    function registerMonsterTeamBuff(monster,buff,display){
        buff.displayBuff=display;
        monster.v141TeamBuffs=monster.v141TeamBuffs||[];
        monster.v141TeamBuffs.push(buff);
        monster.activeBuffs=monster.activeBuffs||[];
        monster.activeBuffs.push(display);
    }

    function finalSkillLevel(monster,skill){
        const max=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        const requested=Math.max(1,Math.floor(
            numeric(monster&&monster.v141ForceSkillLevel)||numeric(monster&&monster.v141SkillLevel)||max
        ));
        return Math.min(max,requested);
    }

    function resolveNorthHeal(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.healSpell:null;
        if(!monster||monster.name!=="北帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const allies=allyTriTargets(monsterIndex);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        if(!needsHeal||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex);
        }
        const level=finalSkillLevel(monster,skill);
        const hpAmount=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(level-1);
        const spAmount=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(level-1);
        let cleansed=0;
        allies.forEach(entry=>{
            const ally=entry.monster;
            const healed=restoreMonsterHp(ally,hpAmount);
            const restored=restoreMonsterSp(ally,spAmount);
            if(skill.cleanseAll&&Array.isArray(ally.statusEffects)){
                cleansed+=ally.statusEffects.length;
                ally.statusEffects=[];
            }
            if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
            if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                const card=document.getElementById("battleMonster"+entry.index);
                if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
            }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放最高等級治療術：同排最多"+allies.length+"名友方各回復"+
                hpAmount+" HP、"+spAmount+" SP"+(skill.cleanseAll?"，並解除"+cleansed+"個負面狀態":"")+"。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthHeal=resolveNorthHeal;

    function resolveNorthRevive(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.revive:null;
        if(!monster||monster.name!=="北帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const defeated=currentAbyssEntriesIncludingDefeated().filter(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        ).sort((left,right)=>(right.monster.rank==="boss")-(left.monster.rank==="boss")||left.index-right.index);
        const target=defeated[0];
        if(!target||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex);
        }
        const level=finalSkillLevel(monster,skill);
        const percent=levelValue(skill.reviveHealPercentByLevel,level,100);
        const maxHp=Math.max(1,numeric(target.monster.maxHP)||monsterBaseMaxHp(target.monster));
        const restored=Math.max(1,Math.floor(maxHp*percent/100));
        target.monster.hp=Math.min(maxHp,restored);
        target.monster.alive=true;
        if(typeof showMonsterHit==="function"){ showMonsterHit(target.index,target.monster.hp,"heal"); }
        if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",target.index,"revive"); }
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放最高等級復活術，使"+target.monster.name+"以"+percent+"% HP復活。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthRevive=resolveNorthRevive;

    function resolveNorthSupport(monsterIndex,forceCast){
        const hasDefeated=currentAbyssEntriesIncludingDefeated().some(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        );
        return hasDefeated
            ?resolveNorthRevive(monsterIndex,forceCast)
            :resolveNorthHeal(monsterIndex,forceCast);
    }
    window.v155ResolveNorthSupport=resolveNorthSupport;

    function resolveEastEarthShield(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.earthShield:null;
        if(!monster||monster.name!=="東帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targets=allyTriTargets(monsterIndex).filter(entry=>!hasNamedState(entry.monster,"萬象土盾"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"earth",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const percent=Math.max(0,numeric(skill.reflectPercent)||50);
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"earthShield",entry.index,skill.name)){ return; }
            const display={type:"earthShield",v141BuffType:"earthShield",turnsLeft:duration,percent:percent};
            const buff={type:"earthShield",turnsLeft:duration,percent:percent};
            markNamedState(display,"earthShield");
            markNamedState(buff,"earthShield");
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("東帝天尊施放萬象土盾，同排"+applied+"名友方獲得"+percent+"%反傷，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveEastEarthShield=resolveEastEarthShield;

    function resolveHeavenCalm(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.dinghaishenzhen:null;
        if(!monster||monster.name!=="天帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targets=currentAbyssEntries().filter(entry=>!hasNamedState(entry.monster,"氣定神閒"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const resistance=Math.max(0,numeric(skill.statusResistBonus)||65);
        const accuracy=Math.max(0,numeric(skill.accuracyBonusPercent)||50);
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"dinghaishenzhen",entry.index,skill.name)){ return; }
            const display={type:"v141TeamBuff",v141BuffType:"resistance",turnsLeft:duration,accuracyBonusPercent:accuracy};
            const buff={type:"resistance",turnsLeft:duration,amount:resistance,accuracyBonusPercent:accuracy};
            markNamedState(display,"dinghaishenzhen");
            markNamedState(buff,"dinghaishenzhen");
            entry.monster.resistance=numeric(entry.monster.resistance)+resistance;
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("天帝天尊施放氣定神閒，"+applied+"名友方異常抗性提升"+resistance+"%、命中提升"+
                accuracy+"%，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveHeavenCalm=resolveHeavenCalm;

    function resolveWindEliteDodge(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.dodgeSkill:null;
        if(!monster||monster.name!=="天兵天將"||monster.element!=="wind"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){
            return false;
        }
        const targets=allyTriTargets(monsterIndex).filter(entry=>!hasNamedState(entry.monster,"風行"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const percent=Math.max(0,numeric(skill.evasionBonusPercent)||75);
        let applied=0;
        targets.forEach(entry=>{
            const ally=entry.monster;
            if(!canApplyNamedState(ally,"dodgeSkill",entry.index,skill.name)){ return; }
            ensureV155EvasionBase(ally);
            const display={type:"dodgeSkill",v141BuffType:"dodge",turnsLeft:duration};
            const state={
                type:"dodgeSkill",turnsLeft:duration,bonusPercent:percent,displayBuff:display,
                battleToken:currentBattleToken(),expiresTurn:currentRound()+duration
            };
            markNamedState(display,"dodgeSkill");
            markNamedState(state,"dodgeSkill");
            ally.v155WindDodge=state;
            ally.activeBuffs=ally.activeBuffs||[];
            ally.activeBuffs.push(display);
            recomputeV155Evasion(ally);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("風屬性天兵天將施放閃躲術，同排"+applied+"名友方獲得【風行】，閃躲率提升"+
                percent+"%，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveWindEliteDodge=resolveWindEliteDodge;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&hardControlled(monster)){ return false; }
            if(monster&&monster.v155FinalAbyss){
                if(monster.name==="東帝天尊"){ return resolveEastEarthShield(monsterIndex); }
                if(monster.name==="天帝天尊"){ return resolveHeavenCalm(monsterIndex); }
                if(monster.name==="極帝天尊"){ return resolveExtremeEmperorAction(monsterIndex); }
                if(monster.name==="北帝天尊"){ return resolveNorthSupport(monsterIndex); }
                if(monster.name==="天兵天將"&&monster.element==="wind"){
                    return resolveWindEliteDodge(monsterIndex);
                }
            }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function removeEvasionBlessing(monster){
        const blessing=monster&&monster.v155EvasionBlessing;
        if(!blessing){ return; }
        removeDisplayBuff(monster,blessing.displayBuff);
        delete monster.v155EvasionBlessing;
        recomputeV155Evasion(monster);
    }

    function removeWindDodge(monster){
        const state=monster&&monster.v155WindDodge;
        if(!state){ return; }
        removeDisplayBuff(monster,state.displayBuff);
        delete monster.v155WindDodge;
        recomputeV155Evasion(monster);
    }

    function tickV155TimedStates(){
        const token=currentBattleToken();
        const round=currentRound();
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(monster=>{
                const blessing=monster&&monster.v155EvasionBlessing;
                if(blessing){
                    if(blessing.battleToken!==token||round>=numeric(blessing.expiresTurn)){ removeEvasionBlessing(monster); }
                    else{ blessing.displayBuff.turnsLeft=Math.max(1,numeric(blessing.expiresTurn)-round); }
                }
                const dodge=monster&&monster.v155WindDodge;
                if(dodge){
                    if(dodge.battleToken!==token||round>=numeric(dodge.expiresTurn)){ removeWindDodge(monster); }
                    else{
                        dodge.turnsLeft=Math.max(1,numeric(dodge.expiresTurn)-round);
                        dodge.displayBuff.turnsLeft=dodge.turnsLeft;
                    }
                }
                if(monster&&Array.isArray(monster.activeBuffs)){
                    monster.activeBuffs=monster.activeBuffs.filter(buff=>{
                        if(!buff||buff.type!=="phoenixMight"){ return true; }
                        const active=buff.battleToken===token&&round<numeric(buff.expiresTurn);
                        if(active){ buff.turnsLeft=Math.max(1,numeric(buff.expiresTurn)-round); }
                        else if(typeof addBattleLog==="function"){
                            addBattleLog("⏳鳳威效果已結束。");
                        }
                        return active;
                    });
                }
            });
        }
    }

    if(typeof startTurn==="function"){
        const previousStartTurn=startTurn;
        startTurn=function(){
            tickV155TimedStates();
            return previousStartTurn.apply(this,arguments);
        };
    }

    let phoenixCastContext=null;
    let damageActorContext=null;
    let monsterReflectContext=null;

    function phoenixBuffReady(actor){
        const buff=actor&&Array.isArray(actor.activeBuffs)
            ?actor.activeBuffs.find(entry=>
                entry&&entry.type==="phoenixMight"&&numeric(entry.turnsLeft)>0
            )
            :null;
        return buff&&buff.battleToken===currentBattleToken()&&
            currentRound()>=numeric(buff.readyTurn)&&currentRound()<numeric(buff.expiresTurn)
            ?buff
            :null;
    }

    function finalizePhoenixCast(context){
        if(!context||!context.castStarted||!context.actor){ return; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.phoenixCry:null;
        const threshold=Math.max(1,Math.floor(numeric(skill&&skill.burnBonusThreshold)||3));
        const bonusPercent=Math.max(0,numeric(skill&&skill.nextRoundDamageBonusPercent)||30);
        const duration=Math.max(1,Math.floor(numeric(skill&&skill.nextRoundDamageBonusDuration)||1));
        if(context.burnTargets.size<threshold){
            const targetSide=context.side==="player"?"player":"monster";
            const canApply=typeof window.v173CanApplyNamedPersistentState!=="function"||
                window.v173CanApplyNamedPersistentState(
                    context.actor,"phoenixMight",targetSide,context.actorIndex,"火鳳天鳴"
                );
            if(!canApply){ return; }
            const buff={
                type:"phoenixMight",statusName:"鳳威",turnsLeft:duration,
                battleToken:currentBattleToken(),readyTurn:currentRound()+1,
                expiresTurn:currentRound()+1+duration,bonusPercent:bonusPercent
            };
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,"phoenixMight");
            }
            context.actor.activeBuffs=context.actor.activeBuffs||[];
            context.actor.activeBuffs.push(buff);
            if(typeof addBattleLog==="function"){
                addBattleLog("火鳳天鳴本次成功新增燃燒少於"+threshold+"人，施法者獲得【鳳威】，下一回合造成的所有傷害提升"+bonusPercent+"%。");
            }
        }
    }

    function withDamageActor(actor,callback){
        const previousActor=damageActorContext;
        const previousReflectContext=monsterReflectContext;
        const actorIndex=actor&&typeof player!=="undefined"&&actor===player?0:
            actor&&typeof player2!=="undefined"&&actor===player2?1:
            actor&&typeof player3!=="undefined"&&actor===player3?2:null;
        if(!monsterReflectContext&&actorIndex!==null&&typeof currentBattleMonsters!=="undefined"&&typeof monsters!=="undefined"){
            monsterReflectContext={
                actor:actor,actorIndex:actorIndex,
                hpByMonster:new Map(currentBattleMonsters.map(index=>[monsters[index],monsterBaseHp(monsters[index])]))
            };
        }
        damageActorContext=actor||null;
        try{ return callback(); }
        finally{
            damageActorContext=previousActor;
            monsterReflectContext=previousReflectContext;
        }
    }

    function currentDamageActor(){
        return damageActorContext||window.v149CurrentDamageActor||null;
    }

    window.v155GetCurrentDamageActor=currentDamageActor;
    window.v155GetPhoenixMightMultiplier=function(actor){
        const buff=phoenixBuffReady(actor);
        return buff?1+numeric(buff.bonusPercent)/100:1;
    };

    function activeMonsterEarthShieldPercent(monster){
        return ((monster&&monster.activeBuffs||[]).concat(monster&&monster.v141TeamBuffs||[])).reduce((highest,buff)=>
            buff&&numeric(buff.turnsLeft)>0&&(
                buff.type==="earthShield"||buff.v141BuffType==="earthShield"||buff.statusName==="萬象土盾"
            )?Math.max(highest,numeric(buff.percent)):highest,0
        );
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type){
            const target=typeof monsters!=="undefined"?monsters[index]:null;
            const context=monsterReflectContext;
            const before=context&&target&&context.hpByMonster.has(target)
                ?numeric(context.hpByMonster.get(target)):null;
            const result=previousShowMonsterHit.apply(this,arguments);
            if(context&&target&&before!==null){
                const after=monsterBaseHp(target);
                context.hpByMonster.set(target,after);
                const actualLoss=Math.max(0,before-after);
                const percent=activeMonsterEarthShieldPercent(target);
                if(type==="hp"&&actualLoss>0&&percent>0&&numeric(context.actor.hp)>0){
                    const reflected=Math.max(1,Math.floor(actualLoss*percent/100));
                    context.actor.hp=Math.max(0,numeric(context.actor.hp)-reflected);
                    if(typeof showPlayerHit==="function"){
                        showPlayerHit(reflected,"hp",context.actorIndex,false);
                    }
                    if(typeof addBattleLog==="function"){
                        addBattleLog(target.name+"的萬象土盾反彈"+reflected+"點傷害。");
                    }
                }
            }
            return result;
        };
    }

    function withPhoenixCast(side,actor,actorIndex,callback){
        const previousContext=phoenixCastContext;
        const context={side:side,actor:actor,actorIndex:actorIndex,castStarted:false,burnTargets:new Set()};
        phoenixCastContext=context;
        try{ return callback(); }
        finally{
            finalizePhoenixCast(context);
            phoenixCastContext=previousContext;
        }
    }

    function wrapPlayerPhoenixCast(name,skillArgumentIndex,casterFromArguments,indexFromArguments){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            if(args[skillArgumentIndex]!=="phoenixCry"){ return previous.apply(this,args); }
            const that=this;
            return withPhoenixCast("player",casterFromArguments(args),indexFromArguments(args),()=>previous.apply(that,args));
        };
    }

    wrapPlayerPhoenixCast("castDamageSkill",0,()=>typeof player!=="undefined"?player:null,()=>0);
    wrapPlayerPhoenixCast("castSecondaryCharacterSkill",1,args=>typeof getPartyCharacterByIndex==="function"
        ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0])))):null,args=>Math.max(0,Math.floor(numeric(args[0]))));
    wrapPlayerPhoenixCast("castPlayer2Skill",0,()=>typeof player2!=="undefined"?player2:null,()=>1);

    if(typeof showSkillNameBadge==="function"){
        const previousShowSkillBadge=showSkillNameBadge;
        showSkillNameBadge=function(name,element,actorIndex){
            if(phoenixCastContext&&phoenixCastContext.side==="player"&&name==="火鳳天鳴"&&
                (actorIndex===undefined||numeric(actorIndex)===numeric(phoenixCastContext.actorIndex))){
                phoenixCastContext.castStarted=true;
            }
            return previousShowSkillBadge.apply(this,arguments);
        };
    }

    if(typeof showMonsterSkillNameBadge==="function"){
        const previousShowMonsterBadge=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(name,element,monsterIndex){
            if(phoenixCastContext&&phoenixCastContext.side==="monster"&&name==="火鳳天鳴"&&
                numeric(monsterIndex)===numeric(phoenixCastContext.actorIndex)){
                phoenixCastContext.castStarted=true;
            }
            return previousShowMonsterBadge.apply(this,arguments);
        };
    }

    if(typeof applyBurnEffect==="function"){
        const previousApplyBurn=applyBurnEffect;
        applyBurnEffect=function(target){
            const result=previousApplyBurn.apply(this,arguments);
            if(result===true&&phoenixCastContext&&phoenixCastContext.castStarted&&target){
                phoenixCastContext.burnTargets.add(target);
            }
            return result;
        };
    }

    function wrapPlayerDamageActor(name,actorFromArguments){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            const actor=actorFromArguments(args);
            const that=this;
            return withDamageActor(actor,()=>previous.apply(that,args));
        };
    }

    wrapPlayerDamageActor("normalAttack",()=>typeof player!=="undefined"?player:null);
    wrapPlayerDamageActor("castDamageSkill",()=>typeof player!=="undefined"?player:null);
    wrapPlayerDamageActor("secondaryCharacterNormalAttack",args=>
        typeof getPartyCharacterByIndex==="function"
            ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0]))))
            :null
    );
    wrapPlayerDamageActor("castSecondaryCharacterSkill",args=>
        typeof getPartyCharacterByIndex==="function"
            ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0]))))
            :null
    );
    wrapPlayerDamageActor("player2NormalAttack",()=>typeof player2!=="undefined"?player2:null);
    wrapPlayerDamageActor("castPlayer2Skill",()=>typeof player2!=="undefined"?player2:null);

    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            const invoke=()=>withDamageActor(monster,()=>
                withPhoenixCast("monster",monster,monsterIndex,()=>previousMonsterAttack.apply(that,args))
            );
            const invokeAtForcedLevel=()=>withForcedFinalAbyssSkillLevel(monster,invoke);
            return hardControlled(monster)?withHardControlDelay(invokeAtForcedLevel):invokeAtForcedLevel();
        };
    }

    patchCurrentFinalAbyssRoster();

    window.v155RuleDiagnostics=function(){
        return {
            version:VERSION,hardControlSkipMs:HARD_CONTROL_SKIP_MS,
            elementalSkillDataOwnedByFinalLayers:true,
            monsterOnlyFireBurst:!!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike)
        };
    };
})();


/* bundled source: js/47-v158-combat-tuning.js */
/* =====================================================
   V158 — final skill, hit, damage and monster evasion tuning
===================================================== */
(function installV158CombatTuning(){
    "use strict";

    if(typeof window==="undefined"||window.__v158CombatTuningInstalled){ return; }
    window.__v158CombatTuningInstalled=true;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    function hitChancePercent(casterAccuracy,targetEvasion,directChanceReductionPercent){
        const directReduction=Math.max(0,numeric(directChanceReductionPercent));
        const rawAccuracyChance=
            95+
            numeric(casterAccuracy)*0.3-
            directReduction;
        const accuracyChance=clamp(rawAccuracyChance,50,99);
        const evasionRate=clamp(numeric(targetEvasion),0,85);
        return clamp(accuracyChance*(1-evasionRate/100),1,99);
    }

    window.v158GetHitChancePercent=hitChancePercent;

    if(typeof rollHitChance==="function"){
        rollHitChance=function(casterAccuracy,targetEvasion,directChanceReductionPercent){
            return Math.random()*100<hitChancePercent(
                casterAccuracy,
                targetEvasion,
                directChanceReductionPercent
            );
        };
    }

    function normalizeMonsterDefaultEvasion(monster){
        if(!monster){ return monster; }
        const level=Math.max(1,numeric(monster.level)||1);
        if(monster.evasion===undefined){
            monster.evasion=Math.min(30,level*0.3);
        }
        return monster;
    }

    const V17342_HALF_MONSTER_FIELDS=[
        "maxHP","hp","maxSP","sp","attack","magicAttack","defense",
        "attackPoints","vitalityPoints","energyPoints","intelligencePoints","spiritPoints","agilityPoints",
        "vitality","energy","intelligence","spirit","agility","accuracy","evasion"
    ];

    function halveMonsterCoreStats(monster,marker){
        if(!monster||monster[marker]){ return monster; }
        V17342_HALF_MONSTER_FIELDS.forEach(key=>{
            if(!Number.isFinite(Number(monster[key]))){ return; }
            const minimum=["maxHP","hp","maxSP","sp"].includes(key)?1:0;
            monster[key]=Math.max(minimum,Math.round(Number(monster[key])*0.5));
        });
        if(Number.isFinite(Number(monster.maxHP))){
            monster.hp=Math.max(1,Math.min(Number(monster.maxHP),Number(monster.hp)||Number(monster.maxHP)));
        }
        if(Number.isFinite(Number(monster.maxSP))){
            monster.sp=Math.max(0,Math.min(Number(monster.maxSP),Number(monster.sp)||Number(monster.maxSP)));
        }
        monster[marker]=true;
        return monster;
    }

    function normalizeBeginnerForestMonster(monster){
        if(!monster){ return monster; }
        monster.v173BeginnerForest=true;
        normalizeMonsterDefaultEvasion(monster);
        halveMonsterCoreStats(monster,"v17342BeginnerStatsHalved");
        monster.agilityPoints=0;
        monster.agility=0;
        return monster;
    }

    const DAILY_DUNGEON_SCALE_FIELDS=[
        "maxHP","hp","maxSP","sp","attack","magicAttack","defense",
        "attackPoints","vitalityPoints","energyPoints","intelligencePoints","spiritPoints","agilityPoints",
        "vitality","energy","intelligence","spirit","agility","accuracy","evasion"
    ];

    function getDailyDungeonScaleContext(){
        const run=window.v132ActiveDungeonRun||null;
        let partySize=Math.floor(numeric(run&&run.partySize));
        if(!(partySize>=1&&partySize<=3)&&typeof getExistingPartyIndexes==="function"){
            partySize=getExistingPartyIndexes().slice(0,3).filter(index=>{
                const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
                return !!character;
            }).length;
        }
        partySize=Math.max(1,Math.min(3,partySize||1));
        const partyMultiplier=partySize===1?.40:partySize===2?.72:1;

        let highestLevel=Math.floor(numeric(run&&run.highestPartyLevel));
        if(!(highestLevel>0)&&typeof getExistingPartyIndexes==="function"){
            highestLevel=getExistingPartyIndexes().slice(0,3).reduce((highest,index)=>{
                const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
                return character?Math.max(highest,Math.floor(numeric(character.level)||1)):highest;
            },1);
        }
        highestLevel=Math.max(1,highestLevel||1);
        const levelMultiplier=highestLevel<=15?.80:highestLevel<=20?.90:highestLevel<=50?1:1.05;
        return {
            partySize:partySize,
            highestLevel:highestLevel,
            partyMultiplier:partyMultiplier,
            levelMultiplier:levelMultiplier,
            difficultyMultiplier:DAILY_DUNGEON_DIFFICULTY_MULTIPLIER,
            factor:partyMultiplier*levelMultiplier*DAILY_DUNGEON_DIFFICULTY_MULTIPLIER
        };
    }

    const DAILY_DUNGEON_DIFFICULTY_MULTIPLIER=.5;
    const FORMAL_DAILY_DUNGEON_TYPES=new Set(["exp","material","gold"]);

    function isFormalDailyDungeonMonster(monster){
        return !!(monster&&FORMAL_DAILY_DUNGEON_TYPES.has(String(monster.v173DailyDungeonType||"")));
    }

    function normalizeDailyDungeonMonster(monster){
        if(!isFormalDailyDungeonMonster(monster)||monster.v141Abyss===true){ return monster; }
        normalizeMonsterDefaultEvasion(monster);
        if(!monster.v173DailyDungeonBaseStats){
            const base={};
            DAILY_DUNGEON_SCALE_FIELDS.forEach(key=>{
                if(Number.isFinite(Number(monster[key]))){ base[key]=Number(monster[key]); }
            });
            monster.v173DailyDungeonBaseStats=base;
        }
        const context=getDailyDungeonScaleContext();
        if(!Object.prototype.hasOwnProperty.call(monster,"v173DailyDungeonBaseSkillChance")){
            monster.v173DailyDungeonBaseSkillChance=Number.isFinite(Number(monster.skillChance))?Number(monster.skillChance):0;
        }
        const base=monster.v173DailyDungeonBaseStats;
        DAILY_DUNGEON_SCALE_FIELDS.forEach(key=>{
            if(!Object.prototype.hasOwnProperty.call(base,key)){ return; }
            const minimum=key==="maxHP"||key==="hp"?1:0;
            monster[key]=Math.max(minimum,Math.round(base[key]*context.factor));
        });
        if(Number.isFinite(Number(monster.maxHP))){ monster.hp=Math.max(1,Number(monster.maxHP)); }
        if(Number.isFinite(Number(monster.maxSP))){ monster.sp=Math.max(0,Number(monster.maxSP)); }
        monster.v173DailyDungeonScaleFactor=context.factor;
        monster.v173DailyDungeonPartySize=context.partySize;
        monster.v173DailyDungeonHighestLevel=context.highestLevel;
        monster.v173DailySoloProtected=context.partySize===1&&context.highestLevel<=20;
        monster.v173DailyNoAccuracyCritBoost=monster.v173DailySoloProtected;
        const baseSkillChance=Math.max(0,Math.min(1,Number(monster.v173DailyDungeonBaseSkillChance)||0));
        if(monster.v173DailySoloProtected){
            monster.skillChance=Number(monster.v141DungeonStage)===1?0:Math.min(.45,baseSkillChance*.60);
        }else{
            monster.skillChance=baseSkillChance;
            monster.v173DailyBossUsedSkillLastAction=false;
        }
        return monster;
    }

    window.v158NormalizeMonsterDefaultEvasion=normalizeMonsterDefaultEvasion;
    window.v17342NormalizeBeginnerForestMonster=normalizeBeginnerForestMonster;
    window.v17342NormalizeDailyDungeonMonster=normalizeDailyDungeonMonster;
    window.v173GetDailyDungeonScaleContext=getDailyDungeonScaleContext;
    window.v17344IsFormalDailyDungeonMonster=isFormalDailyDungeonMonster;

    if(typeof makeZoneMonster==="function"){
        const previousMakeZoneMonster=makeZoneMonster;
        makeZoneMonster=function(){
            return normalizeMonsterDefaultEvasion(
                previousMakeZoneMonster.apply(this,arguments)
            );
        };
    }

    if(typeof zoneConfig!=="undefined"){
        Object.keys(zoneConfig).forEach(key=>{
            const config=zoneConfig[key];
            const entries=config&&typeof config.monsters==="function"
                ?config.monsters()
                :[];
            (entries||[]).forEach(monster=>{
                normalizeMonsterDefaultEvasion(monster);
                if(key==="forest"){ normalizeBeginnerForestMonster(monster); }
            });
        });
    }

    if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
        monsters.forEach(monster=>{
            normalizeMonsterDefaultEvasion(monster);
            if(monster&&monster.v173BeginnerForest===true){ normalizeBeginnerForestMonster(monster); }
        });
    }

    if(typeof rollBeginnerForestNormalAttackDamage==="function"){
        rollBeginnerForestNormalAttackDamage=function(){
            return 5+Math.floor(Math.random()*4);
        };
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const isDungeonBattle=
                typeof currentZone!=="undefined"&&currentZone==="dungeon"&&
                !!window.v132ActiveDungeonRun&&
                typeof currentBattleMonsters!=="undefined"&&
                Array.isArray(currentBattleMonsters)&&
                typeof monsters!=="undefined"&&Array.isArray(monsters);
            if(isDungeonBattle){
                const roster=currentBattleMonsters.map(index=>monsters[index]).filter(Boolean);
                const isAbyss=roster.some(monster=>monster&&monster.v141Abyss===true);
                if(!isAbyss){ roster.forEach(normalizeDailyDungeonMonster); }
            }
            return previousRenderBattle.apply(this,arguments);
        };
    }

    if(typeof getMonsterEvasion==="function"){
        const previousGetMonsterEvasion=getMonsterEvasion;
        getMonsterEvasion=function(monster){
            return previousGetMonsterEvasion.call(
                this,
                normalizeMonsterDefaultEvasion(monster)
            );
        };
    }

    function castTriFreeze(characterIndex,skillId,centerIndex,legacyPlayer2){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        const character=legacyPlayer2
            ?(typeof player2!=="undefined"?player2:null)
            :(typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null);
        const characterKey=legacyPlayer2
            ?"player2"
            :(typeof getPartyCharacterKey==="function"?getPartyCharacterKey(characterIndex):null);
        const stats=legacyPlayer2
            ?(typeof getPlayer2BattleStats==="function"?getPlayer2BattleStats():null)
            :(typeof getPartyBattleStats==="function"?getPartyBattleStats(characterIndex):null);
        const level=skill&&characterKey&&typeof getSkillLevel==="function"
            ?getSkillLevel(characterKey,skillId)
            :0;
        const spCost=skill&&skill.spCost!==undefined?numeric(skill.spCost):numeric(skill&&skill.cost);

        if(!skill||!character||!stats||level<=0||numeric(character.sp)<spCost){ return false; }

        const resolvedIndex=typeof findAliveTargetIndex==="function"
            ?findAliveTargetIndex(centerIndex)
            :centerIndex;
        if(resolvedIndex===null||resolvedIndex===undefined){
            if(!legacyPlayer2&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
            return true;
        }

        character.sp=Math.max(0,numeric(character.sp)-spCost);
        if(typeof selectedMonster!=="undefined"){ selectedMonster=resolvedIndex; }
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        if(typeof showSkillNameBadge==="function"){
            showSkillNameBadge(skill.name,skill.element,characterIndex);
        }
        if(typeof setTimeout==="function"&&typeof showPlayerSpPopup==="function"){
            setTimeout(()=>showPlayerSpPopup(spCost,characterIndex),500);
        }

        const targets=typeof getSkillTargets==="function"
            ?getSkillTargets(resolvedIndex,"tri")
            :[resolvedIndex];

        targets.forEach(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            if(!monster||monster.alive===false||numeric(monster.hp)<=0){ return; }
            const rollArguments=[
                skill.freezeChance,
                character.level,
                monster.level,
                stats.intelligence,
                typeof getMonsterEffectiveSpiritPoints==="function"
                    ?getMonsterEffectiveSpiritPoints(monster)
                    :numeric(monster.spiritPoints),
                true,
                typeof getMonsterRank==="function"?getMonsterRank(monster):monster.rank
            ];
            const statusResult=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(
                    monster,"freeze",rollArguments,"monster",index,skill.name
                )
                :{
                    duplicate:false,
                    hit:typeof rollStatusEffectHit==="function"&&
                        rollStatusEffectHit.apply(null,rollArguments)
                };

            if(statusResult.hit){
                if(typeof applyFreezeEffect==="function"){
                    applyFreezeEffect(monster,skill.freezeDuration);
                }
                if(typeof addBattleLog==="function"){
                    addBattleLog(monster.name+"被冰封了！");
                }
            }else if(!statusResult.duplicate){
                if(typeof showMissEffect==="function"){ showMissEffect(false,index,"抵抗"); }
                if(typeof addBattleLog==="function"){
                    addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗）。");
                }
            }
        });

        if(typeof updateUI==="function"){ updateUI(); }
        if(!legacyPlayer2&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    /* Solo Lv1-20 formal daily protection: wave 1 is normal-attack only.
       From wave 2 onward skills are allowed at a reduced rate; a BOSS that just
       used a skill must perform one non-skill action before another skill. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousDailyProtectedMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(!monster||monster.v173DailySoloProtected!==true||monster.v141Abyss===true){
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster.rank||"regular");
            const forceNormal=Number(monster.v141DungeonStage)===1||
                (rank==="boss"&&monster.v173DailyBossUsedSkillLastAction===true);
            const savedSkillIds=monster.skillIds;
            const savedSupports=monster.v141SupportSkillIds;
            const savedChance=monster.skillChance;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            let usedSkill=false;
            if(forceNormal){
                monster.skillIds=[];
                monster.v141SupportSkillIds=[];
                monster.skillChance=0;
            }
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(String(name||"")!=="普通攻擊"){ usedSkill=true; }
                    return previousBadge.apply(this,arguments);
                };
            }
            try{
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }finally{
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(forceNormal){
                    monster.skillIds=savedSkillIds;
                    monster.v141SupportSkillIds=savedSupports;
                    monster.skillChance=savedChance;
                }
                if(rank==="boss"){ monster.v173DailyBossUsedSkillLastAction=usedSkill; }
            }
        };
    }

    window.v158CastTriFreeze=castTriFreeze;

    if(typeof castSecondaryCharacterSkill==="function"){
        const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
        castSecondaryCharacterSkill=function(characterIndex,skillId,centerIndex){
            if(skillId==="freeze"&&castTriFreeze(characterIndex,skillId,centerIndex,false)){ return; }
            return previousCastSecondaryCharacterSkill.apply(this,arguments);
        };
    }

    if(typeof castPlayer2Skill==="function"){
        const previousCastPlayer2Skill=castPlayer2Skill;
        castPlayer2Skill=function(skillId,centerIndex){
            if(skillId==="freeze"&&castTriFreeze(1,skillId,centerIndex,true)){ return; }
            return previousCastPlayer2Skill.apply(this,arguments);
        };
    }

    if(typeof openInventoryCharacterDetail==="function"){
        const previousOpenInventoryCharacterDetail=openInventoryCharacterDetail;
        openInventoryCharacterDetail=function(){
            const result=previousOpenInventoryCharacterDetail.apply(this,arguments);
            if(typeof document!=="undefined"){
                const rows=Array.from(document.querySelectorAll("#inventoryCharacterDetailStats .inventory-character-detail-row"));
                const evasionRow=rows.find(row=>{
                    const label=row.querySelector("span");
                    return label&&label.textContent.trim()==="閃避";
                });
                const evasionValue=evasionRow&&evasionRow.querySelector("b");
                if(evasionValue){
                    evasionValue.textContent=numeric(evasionValue.textContent).toFixed(1)+"%";
                }
                const note=document.querySelector("#inventoryCharacterDetailStats .inventory-character-detail-note");
                if(note){
                    note.innerHTML=
                        "命中先依95%＋命中×0.3計算（50%～99%），再乘上(1－目標最終閃躲率)。<br>"+
                        "所有閃躲來源採乘算，最終閃躲率最高85%；一般異常每1精神降低0.05個百分點命中率，硬控維持原公式。";
                }
            }
            return result;
        };
    }
})();


/* bundled source: js/48-v159-abyss-battle-portraits.js */
/* =====================================================
   V159 — deterministic battle portrait synchronization
===================================================== */
(function installV159AbyssBattlePortraits(){
    "use strict";

    if(typeof window==="undefined"||window.__v159AbyssBattlePortraitsInstalled){ return; }
    window.__v159AbyssBattlePortraitsInstalled=true;

    function syncPortraits(){
        if(typeof window.v154SyncMonsterPortraits==="function"){
            window.v154SyncMonsterPortraits();
            return;
        }
        if(typeof window.v154SyncAbyssPortraits==="function"){
            window.v154SyncAbyssPortraits();
        }
    }

    function syncAfterDomSettles(){
        syncPortraits();
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(syncPortraits);
        }
        if(typeof setTimeout==="function"){
            setTimeout(syncPortraits,120);
        }
    }

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(){
            const result=previousLaunchDungeonBattle.apply(this,arguments);
            if(result){ syncAfterDomSettles(); }
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncPortraits();
            return result;
        };
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",syncAfterDomSettles,{once:true});
    }else{
        syncAfterDomSettles();
    }
})();


/* bundled source: js/49-v169-element-box-settings.js */
/* =====================================================
   V169 / V173.42 — Element Box settings ownership
   - Auto action remains per character.
   - HP / SP potion thresholds + return-home are shared by the whole party.
   - Settings are locked while Element Box is active; stop first to edit.
===================================================== */
(function installV169ElementBoxSettings(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v169ElementBoxSettingsInstalled){ return; }
    window.__v169ElementBoxSettingsInstalled=true;

    const SETTINGS_PANEL_ID="autoBattleSettingsPanel";
    const STOP_BUTTON_ID="v169ElementBoxStopButton";
    const LOCK_NOTICE_ID="v17342ElementBoxLockNotice";
    const CONTROL_IDS=["autoSettingsCharacterSelect","autoSettingsActionSelect","autoSettingsHP","autoSettingsSP","autoSettingsReturnCity"];
    const IMMEDIATE_FIELD_IDS=["autoSettingsActionSelect","autoSettingsHP","autoSettingsSP","autoSettingsReturnCity"];
    const LOCKED_SETTING_SELECTOR=".auto-setting-card,.auto-threshold-card,.auto-return-card";

    function elementBoxIsActive(){
        if(typeof window.v131GetElementBoxState==="function"){
            try{ const state=window.v131GetElementBoxState(); if(state&&state.active){ return true; } }catch(_){ }
        }
        return typeof autoBattle!=="undefined"&&!!autoBattle;
    }

    function selectedCharacterIndex(){
        const select=document.getElementById("autoSettingsCharacterSelect");
        if(!select){ return null; }
        const index=Number(select.value);
        if(!Number.isInteger(index)||index<0||index>2){ return null; }
        if(typeof getPartyCharacterByIndex==="function"&&!getPartyCharacterByIndex(index)){ return null; }
        return index;
    }

    function existingIndexes(){
        if(typeof getExistingPartyIndexes==="function"){ return getExistingPartyIndexes().slice(0,3); }
        return [0,1,2].filter(index=>typeof getPartyCharacterByIndex!=="function"||!!getPartyCharacterByIndex(index));
    }

    function sharedSourceConfig(){
        if(typeof getPartyAutoConfig!=="function"){ return null; }
        const indexes=existingIndexes();
        return getPartyAutoConfig(indexes.length?indexes[0]:0)||null;
    }

    function syncSharedRecoveryForm(){
        const config=sharedSourceConfig();
        if(!config){ return; }
        const hp=document.getElementById("autoSettingsHP");
        const sp=document.getElementById("autoSettingsSP");
        const back=document.getElementById("autoSettingsReturnCity");
        if(hp){ hp.value=String(config.hp==null?50:config.hp); }
        if(sp){ sp.value=String(config.sp==null?25:config.sp); }
        if(back){ back.checked=!!config.returnToCityWhenEmpty; }
    }

    function writeSharedRecoveryFromForm(){
        if(typeof getPartyAutoConfig!=="function"){ return; }
        const hp=document.getElementById("autoSettingsHP");
        const sp=document.getElementById("autoSettingsSP");
        const back=document.getElementById("autoSettingsReturnCity");
        const hpValue=hp?Number(hp.value):50;
        const spValue=sp?Number(sp.value):25;
        const returnValue=!!(back&&back.checked);
        existingIndexes().forEach(index=>{
            const config=getPartyAutoConfig(index);
            if(!config){ return; }
            config.hp=hpValue;
            config.sp=spValue;
            config.returnToCityWhenEmpty=returnValue;
        });
    }

    function normalizeSharedRecoveryAcrossParty(){
        syncSharedRecoveryForm();
        writeSharedRecoveryFromForm();
    }

    function notifyLocked(){
        alert("先停止元素匣，才能設定");
    }

    function persistSelectedCharacterSettings(){
        if(elementBoxIsActive()){ notifyLocked(); syncSharedRecoveryForm(); return false; }
        const index=selectedCharacterIndex();
        if(index===null||typeof saveAutoSettingsFormToCharacter!=="function"){ return false; }
        saveAutoSettingsFormToCharacter(index);
        writeSharedRecoveryFromForm();
        if(typeof saveGame==="function"){ saveGame(); }
        return true;
    }
    window.v169PersistElementBoxSettings=persistSelectedCharacterSettings;

    function bindImmediatePersistence(){
        IMMEDIATE_FIELD_IDS.forEach(id=>{
            const field=document.getElementById(id);
            if(!field||typeof field.addEventListener!=="function"||field.dataset.v169ImmediateSave==="1"){ return; }
            field.dataset.v169ImmediateSave="1";
            field.addEventListener("change",()=>{
                if(elementBoxIsActive()){ notifyLocked(); syncSharedRecoveryForm(); return; }
                persistSelectedCharacterSettings();
            });
        });
    }

    function bindLockedInteractionGuard(){
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        if(!panel||typeof panel.addEventListener!=="function"||panel.dataset.v17342LockGuard==="1"){ return; }
        panel.dataset.v17342LockGuard="1";
        panel.addEventListener("click",event=>{
            if(!elementBoxIsActive()){ return; }
            const target=event&&event.target;
            if(!target||typeof target.closest!=="function"){ return; }
            if(target.closest("#"+STOP_BUTTON_ID)){ return; }
            const setting=target.closest(LOCKED_SETTING_SELECTOR);
            if(!setting||typeof panel.contains==="function"&&!panel.contains(setting)){ return; }
            if(typeof event.preventDefault==="function"){ event.preventDefault(); }
            if(typeof event.stopPropagation==="function"){ event.stopPropagation(); }
            notifyLocked();
            syncSharedRecoveryForm();
        },true);
    }

    if(typeof switchAutoSettingsCharacter==="function"){
        const previous=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(initializing){
            /* openHomeFeature('autoBattleSettings') uses true only to populate the
               existing form. That initialization is not a player edit and must
               never show the locked warning. */
            if(elementBoxIsActive()&&initializing!==true){ notifyLocked(); return false; }
            const result=previous.apply(this,arguments);
            syncSharedRecoveryForm();
            if(!elementBoxIsActive()&&typeof saveGame==="function"){ saveGame(); }
            return result;
        };
    }

    function settingsPanelIsVisible(){
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        return !!(panel&&panel.style&&panel.style.display!=="none");
    }

    let closeSaveDepth=0;
    function wrapCloseWithSave(previousClose){
        return function(){
            if(closeSaveDepth===0&&settingsPanelIsVisible()&&!elementBoxIsActive()){ persistSelectedCharacterSettings(); }
            closeSaveDepth++;
            try{ return previousClose.apply(this,arguments); }
            finally{ closeSaveDepth--; }
        };
    }
    if(typeof closeHomeFeature==="function"){ closeHomeFeature=wrapCloseWithSave(closeHomeFeature); }
    if(typeof closeAutoBattleSettings==="function"){ closeAutoBattleSettings=wrapCloseWithSave(closeAutoBattleSettings); }

    function ensureStopButton(){
        let button=document.getElementById(STOP_BUTTON_ID);
        if(button){ return button; }
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&panel.querySelector?panel.querySelector(".auto-premium-status"):null;
        if(!status||typeof document.createElement!=="function"){ return null; }
        button=document.createElement("button");
        button.id=STOP_BUTTON_ID;
        button.type="button";
        button.className="v169-element-box-stop";
        button.textContent="停止元素匣";
        button.hidden=true;
        button.setAttribute("aria-label","停止元素匣");
        button.addEventListener("click",()=>window.v169StopElementBox());
        status.appendChild(button);
        return button;
    }

    function ensureLockNotice(){
        let notice=document.getElementById(LOCK_NOTICE_ID);
        if(notice){ return notice; }
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        if(!panel||typeof document.createElement!=="function"){ return null; }
        notice=document.createElement("div");
        notice.id=LOCK_NOTICE_ID;
        notice.className="v17342-element-box-lock-notice";
        notice.textContent="元素匣運作中：先停止元素匣，才能修改設定";
        notice.hidden=true;
        const shared=panel.querySelector&&panel.querySelector(".v17342-element-box-shared");
        panel.insertBefore(notice,shared||panel.firstChild||null);
        return notice;
    }

    function syncElementBoxSettingControls(){
        const active=elementBoxIsActive();
        const primary=document.getElementById("autoBattleButton");
        const stopButton=ensureStopButton();
        const notice=ensureLockNotice();
        const panel=document.getElementById(SETTINGS_PANEL_ID);
        const status=panel&&panel.querySelector?panel.querySelector(".auto-premium-status"):null;

        /* Keep setting controls technically enabled so taps reach the capture
           guard and can explain the lock. The guard prevents the edit itself. */
        CONTROL_IDS.forEach(id=>{
            const field=document.getElementById(id);
            if(!field){ return; }
            field.disabled=false;
            field.setAttribute("aria-disabled",active?"true":"false");
            field.dataset.v169Locked=active?"1":"0";
        });
        if(primary){
            primary.setAttribute("onclick","v169SaveElementBoxSettings()");
            primary.textContent=active?"先停止後設定":"套用並啟動";
            primary.disabled=active;
            primary.classList.toggle("active",active);
            primary.dataset.v169Mode=active?"locked":"activate";
        }
        if(stopButton){ stopButton.hidden=!active; stopButton.classList.toggle("active",active); }
        if(notice){ notice.hidden=!active; }
        if(status){ status.classList.toggle("v169-element-box-active",active); }
        if(panel){ panel.classList.toggle("v17342-settings-locked",active); }
        syncSharedRecoveryForm();
    }
    window.v169SyncElementBoxSettingControls=syncElementBoxSettingControls;

    window.v169SaveElementBoxSettings=function(){
        if(elementBoxIsActive()){ notifyLocked(); return false; }
        persistSelectedCharacterSettings();
        if(typeof confirmAutoBattleSettings==="function"){ return confirmAutoBattleSettings(); }
        return true;
    };

    window.v169StopElementBox=function(){
        if(!elementBoxIsActive()||typeof toggleAutoBattle!=="function"){ syncElementBoxSettingControls(); return false; }
        if(typeof autoBattle!=="undefined"&&!autoBattle){ autoBattle=true; }
        const result=toggleAutoBattle();
        syncElementBoxSettingControls();
        return result;
    };

    if(typeof updateAutoButton==="function"){
        const previous=updateAutoButton;
        updateAutoButton=function(){ const result=previous.apply(this,arguments); syncElementBoxSettingControls(); return result; };
    }

    function afterOpen(type){
        if(type!=="autoBattleSettings"){ return; }
        bindImmediatePersistence();
        bindLockedInteractionGuard();
        syncElementBoxSettingControls();
    }
    if(typeof openHomeFeature==="function"){
        const previous=openHomeFeature;
        openHomeFeature=function(type){ const result=previous.apply(this,arguments); afterOpen(type); return result; };
    }
    if(typeof openAutoBattleSettings==="function"){
        const previous=openAutoBattleSettings;
        openAutoBattleSettings=function(){ const result=previous.apply(this,arguments); afterOpen("autoBattleSettings"); return result; };
    }

    normalizeSharedRecoveryAcrossParty();
    bindImmediatePersistence();
    bindLockedInteractionGuard();
    syncElementBoxSettingControls();
})();


/* bundled source: js/50-v169-water-skill-rules.js */
/* =====================================================
   V169 — final Water skill rules

   This late runtime is the single authoritative layer for every Water
   skill. It patches the existing database and narrow compatibility seams
   without creating a second combat system.
===================================================== */
(function installV169WaterSkillRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v169WaterSkillRulesInstalled){ return; }
    window.__v169WaterSkillRulesInstalled=true;

    const VERSION="169";
    const WATER_DAMAGE_SKILL_IDS=[
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"
    ];
    const WATER_SKILL_IDS=WATER_DAMAGE_SKILL_IDS.concat([
        "freeze","healSpell","revive","purifyMind","waterEX"
    ]);
    const WATER_PREVIEW_SKILL_ID_SET=new Set(WATER_DAMAGE_SKILL_IDS.concat(["freeze"]));
    const WATER_SUPPORT_PREVIEW_SKILL_ID_SET=new Set(["healSpell","revive","purifyMind","waterEX"]);
    const STATUS_FIELDS=[
        "freezeChance","freezeDuration","freezeSingleTarget",
        "teamFreezeChance","teamFreezeDuration",
        "frostbiteChance","frostbiteDuration","statusResistBonus"
    ];
    const FROSTBITE_REMAINING_RATE=.75;

    const FINAL_SKILLS={
        waterKnife:{
            id:"waterKnife",tier:1,name:"水刀斬",element:"water",category:"physical",
            targetType:"single",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:21,damagePerLevel:5,spCost:6,
            frostbiteChance:30,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:[],
            description:"初次學習需2技能點，對單體造成21點傷害，消耗6 SP；30%基礎機率使目標【凍傷】1回合。吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+5。"
        },
        frostPunch:{
            id:"frostPunch",tier:2,name:"冰霜拳",element:"water",category:"physical",
            targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,
            baseDamage:32,damagePerLevel:7,spCost:17,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],
            description:"需先學習水刀斬。初次學習需10技能點，對單體造成32點傷害，消耗17 SP；35%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        iceSpin:{
            id:"iceSpin",tier:3,name:"冰旋一閃",element:"water",category:"physical",
            targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:35,damagePerLevel:7,spCost:45,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],
            description:"需先學習冰霜拳。初次學習需20技能點，對同排中、左、右最多3名有效目標各造成35點傷害，消耗45 SP；各目標有35%基礎機率【凍傷】2回合。依各目標實際受到傷害分別計算3%/4%/5%/6%/7%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        frostCrush:{
            id:"frostCrush",tier:4,name:"冰封重擊",element:"water",category:"physical",
            targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,
            baseDamage:116,damagePerLevel:24,spCost:60,
            frostbiteChance:45,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],
            description:"需先學習冰旋一閃。初次學習需30技能點，對單體造成116點傷害，消耗60 SP；45%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+24。"
        },
        waterBall:{
            id:"waterBall",tier:1,name:"水球術",element:"water",category:"magic",
            targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:10,damagePerLevel:2,spCost:8,
            frostbiteChance:30,frostbiteDuration:1,
            lifestealPercentByLevel:[3,4,5,6,7],requires:[],
            description:"初次學習需2技能點，對同排中、左、右最多3名有效目標各造成10點傷害，消耗8 SP；各目標有30%基礎機率【凍傷】1回合。依各目標實際受到傷害分別計算3%/4%/5%/6%/7%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+2。"
        },
        floodBeast:{
            id:"floodBeast",tier:2,name:"洪水猛獸",element:"water",category:"magic",
            targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,
            baseDamage:105,damagePerLevel:21,spCost:35,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],
            description:"需先學習水球術。初次學習需15技能點，對單體造成105點傷害，消耗35 SP；35%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+21。"
        },
        iceArrowRain:{
            id:"iceArrowRain",tier:3,name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:30,damagePerLevel:6,spCost:75,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
            description:"需先學習洪水猛獸。初次學習需20技能點，對敵方全體每名有效目標各造成30點傷害，消耗75 SP；各目標有35%基礎機率【凍傷】2回合。依所有目標實際受到傷害分別計算1%/2%/3%/4%/5%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        freeze:{
            id:"freeze",tier:4,name:"冰封",element:"water",category:"magic",
            targetType:"column",learnCost:20,maxLevel:1,spCost:32,
            freezeChance:90,freezeDuration:3,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需20技能點，對前、後共最多2名有效敵方目標各以90%基礎機率附加【冰封】3回合，使其完全無法行動；消耗32 SP，最高1級，不造成傷害，套用硬控命中規則。已有同名【冰封】時再次施加直接MISS。"
        },
        healSpell:{
            id:"healSpell",tier:5,name:"治療術",element:"water",category:"heal",
            targetType:"allyTri",learnCost:16,maxLevel:5,upgradeCost:1,
            baseHeal:550,healPerLevel:30,baseHealSP:35,healSPPerLevel:0,spCost:45,
            cleanseAll:true,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需16技能點，對我方中、左、右最多3名存活目標恢復550 HP與固定35 SP，並解除所有可解除負面狀態；施放者本人可恢復HP及解除負面狀態，但不恢復自身SP。消耗45 SP，最高5級，每升1級消耗1技能點，HP恢復量+30。"
        },
        revive:{
            id:"revive",tier:6,name:"復活術",element:"water",category:"revive",
            targetType:"deadAlly",learnCost:18,maxLevel:5,upgradeCost:1,spCost:45,
            reviveHealPercentByLevel:[20,40,60,80,100],requires:["healSpell"],
            description:"需先學習治療術。初次學習需18技能點，選擇1名死亡友方原地復活，依等級恢復20%/40%/60%/80%/100%最大HP，消耗45 SP。復活後不額外恢復SP。最高5級，每升1級消耗1技能點。"
        },
        purifyMind:{
            id:"purifyMind",tier:5,name:"淨心訣",element:"water",category:"buff",
            targetType:"ally",enemyTargetAllowed:true,learnCost:1,maxLevel:1,spCost:22,
            removeAllStates:true,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需1技能點，可選擇1名我方或敵方目標；對我方解除所有增益與所有異常狀態，對敵方解除所有增益狀態（包含結界、護盾等），不會移除敵方負面狀態。消耗22 SP，最高1級。"
        },
        waterEX:{
            id:"waterEX",tier:7,name:"水元素EX",element:"water",category:"passive",
            targetType:"none",learnCost:25,maxLevel:1,damageBonusPercent:5,healBonusPercent:10,
            turnStartCleanseChance:30,requires:[],
            description:"初次學習需25技能點，最大1級；永久提升水元素傷害5%、回復類技能HP恢復量10%，每回合開始前有30%機率解除自身所有可解除的負面狀態。"
        }
    };

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function copyValue(value){
        return Array.isArray(value)?value.slice():value;
    }

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function applyFinalSkillData(){
        if(typeof skillDatabase==="undefined"){ return; }

        WATER_SKILL_IDS.forEach(id=>{
            if(!skillDatabase[id]){ skillDatabase[id]={id:id}; }
            const skill=skillDatabase[id];
            const finalData=FINAL_SKILLS[id];
            if(!skill||!finalData){ return; }

            STATUS_FIELDS.forEach(field=>{ delete skill[field]; });

            if(id==="freeze"){
                delete skill.baseDamage;
                delete skill.damagePerLevel;
                delete skill.lifestealPercentByLevel;
                delete skill.upgradeCost;
            }

            Object.keys(finalData).forEach(key=>{
                skill[key]=copyValue(finalData[key]);
            });
        });
    }

    applyFinalSkillData();
    if(typeof renderSkillLoadout==="function"){
        renderSkillLoadout();
    }
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        window.v173ApplyFormalDamageRoleProfiles(WATER_DAMAGE_SKILL_IDS);
    }

    /* Final Water/utility values load after the historical talisman sync. */
    if(typeof window.v132GetTalismanDefinition==="function"){
        ["Low","Mid","High","Perfect"].forEach(tier=>{
            const freezeTalisman=window.v132GetTalismanDefinition("freezeTalisman"+tier);
            if(freezeTalisman){
                freezeTalisman.sharedSkillId="freeze";
                freezeTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.freeze.maxLevel)||1);
                freezeTalisman.talismanDuration=numeric(skillDatabase.freeze.freezeDuration);
            }
            const stealthTalisman=window.v132GetTalismanDefinition("stealthTalisman"+tier);
            if(stealthTalisman){
                stealthTalisman.sharedSkillId="stealthSkill";
                stealthTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.stealthSkill.maxLevel)||1);
                stealthTalisman.talismanDuration=numeric(skillDatabase.stealthSkill.duration);
            }
            const barrierTalisman=window.v132GetTalismanDefinition("barrierTalisman"+tier);
            if(barrierTalisman){
                barrierTalisman.sharedSkillId="barrier";
                barrierTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.barrier.maxLevel)||1);
                barrierTalisman.talismanDuration=numeric(skillDatabase.barrier.duration);
                barrierTalisman.barrierBlockCount=numeric(skillDatabase.barrier.barrierBlockCount);
            }
        });
    }

    function hasStoredFrostbite(entity){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeFrostbite(entity){
        return !!(entity&&(entity.v169FrostbiteCompatibilityActive===true||hasStoredFrostbite(entity)));
    }

    /* Frostbite is a three-stat soft debuff, never a skill lock. Historical
       V149/V152 wrappers still contain their old gating checks, so only those
       checks see a filtered status list. A compatibility marker keeps the
       real Frostbite penalties active while the underlying skill resolves. */
    function withoutLegacyFrostbiteLock(entity,callback){
        if(!entity||!Array.isArray(entity.statusEffects)||!hasStoredFrostbite(entity)){
            return callback();
        }
        const original=entity.statusEffects;
        const frostbite=original.filter(effect=>effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0);
        const filtered=original.filter(effect=>!frostbite.includes(effect));
        entity.statusEffects=filtered;
        entity.v169FrostbiteCompatibilityActive=true;
        try{ return callback(); }
        finally{
            const after=Array.isArray(entity.statusEffects)?entity.statusEffects:filtered;
            delete entity.v169FrostbiteCompatibilityActive;
            if(after===filtered){
                entity.statusEffects=original;
            }else if(after.length===0){
                /* A cleanse replaced the filtered list with an empty list, so
                   Frostbite must be removed too. */
                entity.statusEffects=[];
            }else{
                entity.statusEffects=after.concat(frostbite.filter(effect=>numeric(effect.turnsLeft)>0));
            }
        }
    }

    function clearLegacyFrostbiteSkillLocks(){
        if(typeof document==="undefined"){ return; }
        const mainButton=document.querySelector&&document.querySelector("#mainBattleMenu > .menu-button.skill.v152-frostbite-blocked");
        if(mainButton){
            mainButton.disabled=false;
            mainButton.classList.remove("v152-frostbite-blocked");
            if(mainButton.dataset){ delete mainButton.dataset.v152FrostbiteBlocked; }
            mainButton.setAttribute("aria-label","技能");
        }
        if(document.querySelectorAll){
            document.querySelectorAll("#skillQuickBarGrid .skill-quick-button.v152-frostbite-blocked").forEach(button=>{
                button.disabled=false;
                button.classList.remove("v152-frostbite-blocked");
            });
        }
    }

    if(typeof window.prepareAction==="function"){
        const previousPrepareAction=window.prepareAction;
        window.prepareAction=function(){
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            const that=this,args=arguments;
            const result=withoutLegacyFrostbiteLock(character,()=>previousPrepareAction.apply(that,args));
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    if(typeof window.resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedPlayerAction=window.resolveQueuedPlayerAction;
        window.resolveQueuedPlayerAction=function(characterIndex){
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const that=this,args=arguments;
            const result=withoutLegacyFrostbiteLock(character,()=>previousResolveQueuedPlayerAction.apply(that,args));
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    if(typeof window.autoActionForCharacter==="function"){
        const previousAutoActionForCharacter=window.autoActionForCharacter;
        window.autoActionForCharacter=function(characterIndex){
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const that=this,args=arguments;
            return withoutLegacyFrostbiteLock(character,()=>previousAutoActionForCharacter.apply(that,args));
        };
    }

    if(typeof window.processSingleMonsterAttack==="function"){
        const previousProcessSingleMonsterAttack=window.processSingleMonsterAttack;
        window.processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            return withoutLegacyFrostbiteLock(monster,()=>previousProcessSingleMonsterAttack.apply(that,args));
        };
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousTryMonsterSpecialAction=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            return withoutLegacyFrostbiteLock(monster,()=>previousTryMonsterSpecialAction.apply(that,args));
        };
    }

    if(typeof window.updateUI==="function"){
        const previousUpdateUI=window.updateUI;
        window.updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    /* Damage -25%. Different named outgoing-damage reductions coexist by
       multiplication, matching the shared status stacking rules. */
    if(typeof window.getOutgoingDamageDownPercent==="function"){
        const previousOutgoingDamageDown=window.getOutgoingDamageDownPercent;
        window.getOutgoingDamageDownPercent=function(attacker){
            const existing=Math.max(0,Math.min(100,numeric(previousOutgoingDamageDown.apply(this,arguments))));
            if(!activeFrostbite(attacker)){ return existing; }
            return Math.max(0,Math.min(100,100-(100-existing)*FROSTBITE_REMAINING_RATE));
        };
    }

    /* Evasion -25% for monsters and all three player stat owners. */
    if(typeof window.getMonsterEvasion==="function"){
        const previousMonsterEvasion=window.getMonsterEvasion;
        window.getMonsterEvasion=function(monster){
            const value=numeric(previousMonsterEvasion.apply(this,arguments));
            return activeFrostbite(monster)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }

    function wrapPlayerEvasionStats(functionName,characterGetter){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const stats=previous.apply(this,arguments);
            const character=characterGetter();
            if(!stats||!activeFrostbite(character)){ return stats; }
            return Object.assign({},stats,{evasion:numeric(stats.evasion)*FROSTBITE_REMAINING_RATE});
        };
    }
    wrapPlayerEvasionStats("getMainCharacterStats",()=>typeof player!=="undefined"?player:null);
    wrapPlayerEvasionStats("getPlayer2BattleStats",()=>typeof player2!=="undefined"?player2:null);
    wrapPlayerEvasionStats("getPlayer3BattleStats",()=>typeof player3!=="undefined"?player3:null);

    /* Status resistance -25%. Spirit-derived and explicit player bonus
       resistance are reduced at their existing authoritative inputs. */
    if(typeof window.getMonsterEffectiveSpiritPoints==="function"){
        const previousMonsterSpirit=window.getMonsterEffectiveSpiritPoints;
        window.getMonsterEffectiveSpiritPoints=function(monster){
            const value=numeric(previousMonsterSpirit.apply(this,arguments));
            return activeFrostbite(monster)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }
    if(typeof window.getFinalBattleSpiritForPlayerTarget==="function"){
        const previousPlayerSpirit=window.getFinalBattleSpiritForPlayerTarget;
        window.getFinalBattleSpiritForPlayerTarget=function(target){
            const value=numeric(previousPlayerSpirit.apply(this,arguments));
            return activeFrostbite(target)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }
    if(typeof window.getPlayerStatusResistBonus==="function"){
        const previousPlayerResistBonus=window.getPlayerStatusResistBonus;
        window.getPlayerStatusResistBonus=function(target){
            const value=numeric(previousPlayerResistBonus.apply(this,arguments));
            return activeFrostbite(target)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }

    /* V149's old application log mentioned a skill prohibition. Keep the
       application itself and rewrite only that obsolete explanatory sentence. */
    if(typeof window.addBattleLog==="function"){
        const previousAddBattleLog=window.addBattleLog;
        window.addBattleLog=function(message){
            let text=String(message==null?"":message);
            if(text.includes("陷入凍傷")&&text.includes("無法使用技能")){
                text=text.replace(/，\d+回合內無法使用技能。/,"，期間傷害、閃避、異常狀態抗性降低25%。");
            }
            return previousAddBattleLog.call(this,text);
        };
    }

    clearLegacyFrostbiteSkillLocks();

    /* V158's compatibility resolver asks for tri. Freeze's final target truth is
       a front/back column of at most two valid targets. */
    function withFinalFreezeTargets(callback){
        const previousTargets=window.getSkillTargets;
        if(typeof previousTargets!=="function"){ return callback(); }

        window.getSkillTargets=function(centerIndex,targetType){
            if(targetType==="tri"){ return previousTargets(centerIndex,"column"); }
            return previousTargets.apply(this,arguments);
        };

        try{ return callback(); }
        finally{ window.getSkillTargets=previousTargets; }
    }

    function wrapSecondaryFreeze(functionName,skillArgumentIndex){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const args=arguments;
            if(args[skillArgumentIndex]==="freeze"){
                return withFinalFreezeTargets(()=>previous.apply(this,args));
            }
            return previous.apply(this,args);
        };
    }

    wrapSecondaryFreeze("castSecondaryCharacterSkill",1);
    wrapSecondaryFreeze("castPlayer2Skill",0);

    if(typeof window.castDamageSkill==="function"&&typeof window.v158CastTriFreeze==="function"){
        const previousCastDamageSkill=window.castDamageSkill;
        window.castDamageSkill=function(skillId,centerIndex){
            if(
                skillId==="freeze"&&
                withFinalFreezeTargets(()=>
                    window.v158CastTriFreeze(0,skillId,centerIndex,false)
                )
            ){
                return;
            }
            return previousCastDamageSkill.apply(this,arguments);
        };
    }

    function levelValue(values,level){
        if(!Array.isArray(values)||!values.length){ return 0; }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level)||1)-1));
        return numeric(values[index]);
    }

    function damageAtLevel(skill,level){
        if(!skill||skill.baseDamage===undefined){ return null; }
        return numeric(skill.baseDamage)+numeric(skill.damagePerLevel)*(Math.max(1,numeric(level))-1);
    }

    function waterSkillEffectParts(skill,level){
        const parts=[];
        const damage=damageAtLevel(skill,level);
        if(damage!==null){
            parts.push("傷害"+Math.floor(damage)+(numeric(skill.damagePerLevel)>0?"（每級+"+numeric(skill.damagePerLevel)+"）":""));
        }
        if(numeric(skill.frostbiteChance)>0){
            parts.push(
                numeric(skill.frostbiteChance)+"%基礎機率凍傷"+
                Math.max(1,numeric(skill.frostbiteDuration)||1)+"回合（傷害-25%、閃避-25%、異常狀態抗性-25%）"
            );
        }
        if(numeric(skill.freezeChance)>0){
            parts.push(
                numeric(skill.freezeChance)+"%基礎機率冰封"+
                Math.max(1,numeric(skill.freezeDuration)||1)+"回合（完全無法行動）"
            );
        }
        if(Array.isArray(skill.lifestealPercentByLevel)){
            parts.push("吸取實際傷害"+levelValue(skill.lifestealPercentByLevel,level)+"%（只恢復自身HP）");
        }
        if(skill.id==="freeze"){ parts.push("不造成傷害"); }
        return parts;
    }

    function buildWaterSkillLevelBreakdown(skill){
        const lines=[];
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        for(let level=1;level<=maxLevel;level++){
            const parts=waterSkillEffectParts(skill,level);
            lines.push(
                '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);">'+
                '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+level+'</span>'+
                '<span style="flex:1;">'+escapeHtml(parts.join("｜"))+'</span></div>'
            );
        }
        return lines.join("");
    }

    function waterSupportEffectText(skill,level){
        const lv=Math.max(1,Math.min(numeric(skill&&skill.maxLevel)||1,Math.floor(numeric(level)||1)));
        if(skill&&skill.id==="healSpell"){
            return "我方中、左、右最多3名存活角色恢復 "+
                (numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(lv-1))+" HP、固定35 SP並解除所有可解除負面狀態；施放者本人可恢復HP與解除負面，但不恢復自身SP";
        }
        if(skill&&skill.id==="revive"){
            return "使1名死亡友方原地復活並恢復最大HP的"+
                levelValue(skill.reviveHealPercentByLevel,lv)+"%；不恢復SP";
        }
        if(skill&&skill.id==="purifyMind"){
            return "可選擇1名我方或敵方目標；我方解除所有增益與異常狀態，敵方解除所有增益（包含結界、護盾等），不移除敵方負面狀態";
        }
        if(skill&&skill.id==="waterEX"){
            return "永久提升水元素傷害5%、回復類技能HP恢復量10%；每回合開始前有30%機率解除自身所有可解除負面狀態";
        }
        return "";
    }

    function buildWaterSupportLevelBreakdown(skill){
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        return Array.from({length:maxLevel},(_,index)=>
            '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);">'+
            '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+(index+1)+'</span>'+
            '<span style="flex:1;">'+escapeHtml(waterSupportEffectText(skill,index+1))+'</span></div>'
        ).join("");
    }

    if(typeof window.getSkillPreviewSummary==="function"){
        const previousPreviewSummary=window.getSkillPreviewSummary;
        window.getSkillPreviewSummary=function(skill){
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSupportEffectText(skill,1)+"。";
            }
            if(!skill||!WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return previousPreviewSummary.apply(this,arguments);
            }
            const scope={single:"單一敵人",tri:"同排最多3名有效敵人",column:"前後排同位置最多2名敵人",all:"敵方全體"}[skill.targetType]||"技能目標";
            const type=skill.id==="freeze"?"純控制":(skill.category==="physical"?"物理傷害":"法術傷害");
            const status=numeric(skill.frostbiteChance)>0
                ?"；可能使目標凍傷：傷害、閃避、異常抗性各降低25%"
                :numeric(skill.freezeChance)>0?"；可能使目標冰封並完全無法行動":"";
            const steal=Array.isArray(skill.lifestealPercentByLevel)?"；吸取實際傷害恢復自身HP":"";
            return scope+"；"+type+status+steal+"。";
        };
    }

    if(typeof window.getSkillEffectPreviewText==="function"){
        const previousEffectPreview=window.getSkillEffectPreviewText;
        window.getSkillEffectPreviewText=function(skill,level){
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSupportEffectText(skill,level);
            }
            if(skill&&WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSkillEffectParts(skill,level).join("｜");
            }
            return previousEffectPreview.apply(this,arguments);
        };
    }

    if(typeof window.buildSkillLevelBreakdownHTML==="function"){
        const previousLevelBreakdown=window.buildSkillLevelBreakdownHTML;
        window.buildSkillLevelBreakdownHTML=function(skill){
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return buildWaterSupportLevelBreakdown(skill);
            }
            if(skill&&WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return buildWaterSkillLevelBreakdown(skill);
            }
            return previousLevelBreakdown.apply(this,arguments);
        };
    }

    if(typeof window.showCreationSkillDetail==="function"){
        const previousCreationSkillDetail=window.showCreationSkillDetail;
        window.showCreationSkillDetail=function(skillId){
            const result=previousCreationSkillDetail.apply(this,arguments);
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(
                skill&&(
                    WATER_PREVIEW_SKILL_ID_SET.has(skill.id)||
                    WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)
                )&&typeof document!=="undefined"
            ){
                const description=document.getElementById("creationSkillDetailDescription");
                const levels=document.getElementById("creationSkillDetailLevels");
                if(description){ description.textContent=skill.description; }
                if(levels){
                    levels.innerHTML=WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)
                        ?buildWaterSupportLevelBreakdown(skill)
                        :buildWaterSkillLevelBreakdown(skill);
                }
            }
            return result;
        };
    }

    window.v169WaterSkillRules=Object.freeze({
        version:VERSION,
        skillIds:WATER_SKILL_IDS.slice(),
        effectParts:function(skillId,level){
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            return skill?waterSkillEffectParts(skill,level).slice():[];
        },
        isFrostbitten:activeFrostbite,
        frostbitePenaltyPercent:25
    });
})();


/* bundled source: js/51-v169-rpg-ui.js */
/* =====================================================
   V169 — RPG dialogs, character layout, shop and dungeon UI
===================================================== */
(function installV169RpgUi(){
    "use strict";

    if(
        typeof window==="undefined" ||
        typeof document==="undefined" ||
        window.__v169RpgUiInstalled
    ){
        return;
    }
    window.__v169RpgUiInstalled=true;

    const dialogQueue=[];
    let activeDialog=null;
    let dialogElements=null;

    function ensureDialogElements(){
        if(dialogElements&&dialogElements.layer.isConnected){
            return dialogElements;
        }

        const layer=document.createElement("div");
        layer.id="v169RpgDialogLayer";
        layer.className="v169-rpg-dialog-layer";
        layer.setAttribute("aria-hidden","true");

        const panel=document.createElement("section");
        panel.className="v169-rpg-dialog";
        panel.setAttribute("role","alertdialog");
        panel.setAttribute("aria-modal","true");
        panel.setAttribute("aria-labelledby","v169RpgDialogTitle");
        panel.setAttribute("aria-describedby","v169RpgDialogMessage");

        const crest=document.createElement("div");
        crest.className="v169-rpg-dialog-crest";
        crest.setAttribute("aria-hidden","true");
        crest.textContent="✦";

        const title=document.createElement("h2");
        title.id="v169RpgDialogTitle";

        const message=document.createElement("div");
        message.id="v169RpgDialogMessage";
        message.className="v169-rpg-dialog-message";

        const actions=document.createElement("div");
        actions.className="v169-rpg-dialog-actions";

        const cancelButton=document.createElement("button");
        cancelButton.type="button";
        cancelButton.className="v169-rpg-dialog-button secondary";

        const confirmButton=document.createElement("button");
        confirmButton.type="button";
        confirmButton.className="v169-rpg-dialog-button secondary";

        actions.append(cancelButton,confirmButton);
        panel.append(crest,title,message,actions);
        layer.appendChild(panel);
        document.body.appendChild(layer);

        cancelButton.addEventListener("click",()=>settleDialog(false));
        confirmButton.addEventListener("click",()=>settleDialog(true));
        layer.addEventListener("keydown",event=>{
            if(event.key!=="Escape"||!activeDialog){ return; }
            event.preventDefault();
            settleDialog(activeDialog.kind==="alert");
        });

        dialogElements={
            layer,
            panel,
            crest,
            title,
            message,
            cancelButton,
            confirmButton
        };
        return dialogElements;
    }

    function normalizeDialogOptions(kind,options){
        const supplied=options&&typeof options==="object"?options:{};
        return {
            title:String(
                supplied.title ||
                (kind==="confirm"?"冒險確認":"冒險提示")
            ),
            confirmText:String(
                supplied.confirmText ||
                (kind==="confirm"?"確定":"知道了")
            ),
            cancelText:String(supplied.cancelText||"返回"),
            tone:supplied.danger?"danger":String(supplied.tone||"normal")
        };
    }

    function pumpDialogQueue(){
        if(activeDialog||dialogQueue.length===0){ return; }

        activeDialog=dialogQueue.shift();
        const elements=ensureDialogElements();
        const options=activeDialog.options;
        activeDialog.previousFocus=document.activeElement;

        elements.panel.dataset.kind=activeDialog.kind;
        elements.panel.dataset.tone=options.tone;
        elements.crest.textContent=options.tone==="danger"?"⚠":"✦";
        elements.title.textContent=options.title;
        elements.message.textContent=activeDialog.message;
        elements.cancelButton.textContent=options.cancelText;
        elements.confirmButton.textContent=options.confirmText;
        elements.cancelButton.hidden=activeDialog.kind!=="confirm";
        elements.confirmButton.classList.toggle("primary",options.tone==="danger");
        elements.confirmButton.classList.toggle("danger",options.tone==="danger");

        elements.layer.classList.add("show");
        elements.layer.setAttribute("aria-hidden","false");
        elements.confirmButton.focus({preventScroll:true});
    }

    function settleDialog(accepted){
        if(!activeDialog){ return; }

        const completed=activeDialog;
        const elements=ensureDialogElements();
        activeDialog=null;
        elements.layer.classList.remove("show");
        elements.layer.setAttribute("aria-hidden","true");

        if(
            completed.previousFocus&&
            completed.previousFocus.isConnected&&
            typeof completed.previousFocus.focus==="function"
        ){
            completed.previousFocus.focus({preventScroll:true});
        }

        completed.resolve(!!accepted);
        Promise.resolve().then(pumpDialogQueue);
    }

    function enqueueDialog(kind,message,options){
        return new Promise(resolve=>{
            dialogQueue.push({
                kind,
                message:String(message===undefined?"":message),
                options:normalizeDialogOptions(kind,options),
                resolve,
                previousFocus:null
            });
            pumpDialogQueue();
        });
    }

    window.rpgAlert=function(message,options){
        return enqueueDialog("alert",message,options);
    };

    window.rpgConfirm=function(message,options){
        return enqueueDialog("confirm",message,options);
    };

    /* Existing alert call sites are intentionally retained as the common
       notification entry point, but they now render through the RPG queue. */
    window.alert=function(message){
        void window.rpgAlert(message);
    };

    /* A synchronous custom confirmation is impossible in the browser.
       Known confirmation paths use rpgConfirm/await; this guard prevents a
       missed legacy call from ever opening a native browser dialog. */
    window.confirm=function(message){
        void window.rpgConfirm(message);
        return false;
    };

    window.v169GetRpgDialogState=function(){
        return {
            active:activeDialog?activeDialog.kind:null,
            queued:dialogQueue.length
        };
    };

    /* ----- Shop: keep the proven potion grid and add the equipment preview page. ----- */
    function arrangeShopColumns(markup){
        if(typeof markup!=="string"||markup.indexOf("shop-potion-list")<0){
            return markup;
        }

        try{
            const template=document.createElement("template");
            template.innerHTML=markup;
            const list=template.content.querySelector(".shop-potion-list");
            if(!list){ return markup; }

            const cards=Array.from(list.querySelectorAll(":scope > .shop-potion-card"));
            const hpCards=cards.filter(card=>card.classList.contains("hp"));
            const spCards=cards.filter(card=>card.classList.contains("sp"));
            if(hpCards.length===0&&spCards.length===0){ return markup; }

            const otherCards=cards.filter(card=>
                !card.classList.contains("hp")&&
                !card.classList.contains("sp")
            );
            const orderedCards=[];
            const rowCount=Math.max(hpCards.length,spCards.length);
            for(let index=0;index<rowCount;index++){
                if(hpCards[index]){ orderedCards.push(hpCards[index]); }
                if(spCards[index]){ orderedCards.push(spCards[index]); }
            }
            orderedCards.push(...otherCards);

            list.textContent="";
            list.classList.remove("v169-shop-columns");
            orderedCards.forEach(card=>list.appendChild(card));
            return template.innerHTML;
        }catch(_){
            return markup;
        }
    }
    window.v169ArrangeShopColumns=arrangeShopColumns;

    const SHOP_REFRESH_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("equipment-shop-daily");
    const SHOP_FREE_REFRESHES=5;
    const SHOP_MAX_REFRESHES=10;
    let shopPage="potion";
    const SHOP_EQUIPMENT_PREVIEW=[
        {name:"青鋒長劍",slot:"武器",glyph:"劍"},{name:"厚背砍刀",slot:"武器",glyph:"刀"},
        {name:"沉木法杖",slot:"武器",glyph:"杖"},{name:"竹骨法扇",slot:"武器",glyph:"扇"},
        {name:"烏金戰甲",slot:"衣服",glyph:"甲"},{name:"素紋法袍",slot:"衣服",glyph:"袍"},
        {name:"鐵紋護腕",slot:"護腕",glyph:"腕"},{name:"雲紗護腕",slot:"護腕",glyph:"袖"},
        {name:"玄鐵戰靴",slot:"鞋子",glyph:"靴"},{name:"行雲法履",slot:"鞋子",glyph:"履"},
        {name:"束髮戰冠",slot:"頭部",glyph:"冠"},{name:"青布法帽",slot:"頭部",glyph:"帽"},
        {name:"精鐵短劍",slot:"武器",glyph:"鋒"},{name:"斬馬闊刀",slot:"武器",glyph:"斬"},
        {name:"檀木短杖",slot:"武器",glyph:"木"},{name:"素竹羽扇",slot:"武器",glyph:"羽"},
        {name:"護心皮甲",slot:"衣服",glyph:"護"},{name:"清風道袍",slot:"衣服",glyph:"道"}
    ];

    function shopEscape(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function shopDateKey(){
        const now=new Date();
        return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    }

    function loadEquipmentShopRefreshState(){
        const today=shopDateKey();
        let state={date:today,refreshCount:0};
        try{
            const stored=JSON.parse(localStorage.getItem(SHOP_REFRESH_STORAGE_KEY)||"{}");
            if(stored&&stored.date===today){
                state.refreshCount=Math.max(0,Math.min(SHOP_MAX_REFRESHES,Math.floor(Number(stored.refreshCount)||0)));
            }
        }catch(_){ }
        return state;
    }

    function saveEquipmentShopRefreshState(state){
        try{ localStorage.setItem(SHOP_REFRESH_STORAGE_KEY,JSON.stringify(state)); }catch(_){ }
    }

    function equipmentShopOffers(refreshCount){
        const count=Math.max(0,Math.floor(Number(refreshCount)||0));
        const start=count*5%SHOP_EQUIPMENT_PREVIEW.length;
        return Array.from({length:6},(_,offset)=>
            SHOP_EQUIPMENT_PREVIEW[(start+offset)%SHOP_EQUIPMENT_PREVIEW.length]
        );
    }

    function renderShopTabs(){
        return '<div class="v17345-shop-tabs" role="tablist" aria-label="商店分類">'+
            '<button type="button" class="'+(shopPage==="potion"?'active':'')+'" onclick="v169SwitchShopPage(\'potion\')">補品</button>'+
            '<button type="button" class="'+(shopPage==="equipment"?'active':'')+'" onclick="v169SwitchShopPage(\'equipment\')">裝備</button></div>';
    }

    function renderEquipmentShop(){
        const state=loadEquipmentShopRefreshState();
        const offers=equipmentShopOffers(state.refreshCount);
        const freeRemaining=Math.max(0,SHOP_FREE_REFRESHES-state.refreshCount);
        const paidPending=state.refreshCount>=SHOP_FREE_REFRESHES&&state.refreshCount<SHOP_MAX_REFRESHES;
        const goldText=typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)).toLocaleString("zh-TW"):"0";
        const refreshLabel=freeRemaining>0
            ?"免費刷新（剩"+freeRemaining+"次）"
            :state.refreshCount>=SHOP_MAX_REFRESHES?"今日刷新已達上限":"金幣刷新・價格待設定";
        return '<div class="v17345-equipment-shop">'+
            '<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+goldText+'</b></div>'+
            '<div class="v17345-equipment-grid">'+offers.map(item=>
                '<article class="v17345-equipment-card"><div class="v17345-equipment-icon" aria-hidden="true">'+shopEscape(item.glyph)+'</div>'+
                '<b>'+shopEscape(item.name)+'</b><span>'+shopEscape(item.slot)+'・普通裝備</span>'+
                '<button type="button" disabled>售價待設定</button></article>'
            ).join("")+'</div>'+
            '<div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / '+SHOP_MAX_REFRESHES+'</b>'+
            '<span>前5次免費；第6～10次使用金幣，價格待下一步確認。</span></div>'+
            '<button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+refreshLabel+'</button></div>'+
            (paidPending?'<p class="v17345-equipment-pending">金幣刷新版面已保留，等確認刷新價格後再開放第6～10次。</p>':'')+
            '</div>';
    }

    function rerenderShop(){
        const body=document.getElementById("homeFeatureModalBody");
        if(body&&typeof renderShopContent==="function"){ body.innerHTML=renderShopContent(); }
    }

    window.v169SwitchShopPage=function(page){
        shopPage=page==="equipment"?"equipment":"potion";
        rerenderShop();
    };

    window.v17345RefreshEquipmentShop=function(){
        const state=loadEquipmentShopRefreshState();
        if(state.refreshCount>=SHOP_FREE_REFRESHES){ return; }
        state.refreshCount++;
        saveEquipmentShopRefreshState(state);
        rerenderShop();
    };

    if(typeof renderShopContent==="function"){
        const previousRenderShopContent=renderShopContent;
        renderShopContent=function(){
            const content=shopPage==="equipment"
                ?renderEquipmentShop()
                :arrangeShopColumns(previousRenderShopContent.apply(this,arguments));
            return '<div class="v17345-shop-shell">'+renderShopTabs()+content+'</div>';
        };
    }

    if(typeof buyShopItem==="function"){
        const previousBuyShopItem=buyShopItem;
        buyShopItem=function(itemId,requestedQuantity){
            const item=typeof getPotionDefinition==="function"
                ?getPotionDefinition(itemId)
                :null;
            const beforeCount=typeof getPotionCount==="function"
                ?Math.max(0,Number(getPotionCount(itemId))||0)
                :0;
            const beforeGold=typeof gold!=="undefined"
                ?Math.max(0,Number(gold)||0)
                :0;

            const announcePurchase=()=>{
                const afterCount=typeof getPotionCount==="function"
                    ?Math.max(0,Number(getPotionCount(itemId))||0)
                    :beforeCount;
                const afterGold=typeof gold!=="undefined"
                    ?Math.max(0,Number(gold)||0)
                    :beforeGold;
                const purchased=Math.max(0,afterCount-beforeCount);
                const spent=Math.max(0,beforeGold-afterGold);
                if(!item||purchased<=0||spent<=0){ return; }
                void window.rpgAlert(
                    "已購買「"+item.name+"」×"+purchased+"。\n花費 "+spent.toLocaleString("zh-TW")+" 金幣。",
                    {
                        title:"購買成功",
                        tone:"success",
                        confirmText:"收下物品"
                    }
                );
            };

            const result=previousBuyShopItem.apply(this,arguments);
            if(result&&typeof result.then==="function"){
                return result.then(value=>{
                    announcePurchase();
                    return value;
                });
            }
            announcePurchase();
            return result;
        };
    }

    /* equipment-progression follows this source inside gameplay-core's fixed execution order. */

    /* ----- Dungeon backpack: reuse the one inventory DOM above the map. ----- */
    if(typeof openMapInventoryOverlay==="function"){
        const previousOpenMapInventoryOverlay=openMapInventoryOverlay;
        openMapInventoryOverlay=function(){
            const dungeonPage=document.getElementById("dungeonPage");
            const mapPage=document.getElementById("mapPage");
            const inventoryPage=document.getElementById("inventoryPage");
            const fromDungeon=!!(
                dungeonPage&&
                dungeonPage.classList.contains("active")
            );

            if(!fromDungeon){
                if(inventoryPage){
                    inventoryPage.classList.remove("v169-dungeon-inventory-overlay");
                }
                return previousOpenMapInventoryOverlay.apply(this,arguments);
            }

            if(typeof battleActive!=="undefined"&&battleActive){ return; }
            const mapWasActive=!!(
                mapPage&&
                mapPage.classList.contains("active")
            );
            if(mapPage&&!mapWasActive){ mapPage.classList.add("active"); }

            let result;
            try{
                result=previousOpenMapInventoryOverlay.apply(this,arguments);
            }finally{
                if(mapPage&&!mapWasActive){ mapPage.classList.remove("active"); }
            }

            if(
                inventoryPage&&
                inventoryPage.classList.contains("map-inventory-overlay-open")
            ){
                inventoryPage.classList.add("v169-dungeon-inventory-overlay");
            }
            return result;
        };
    }

    if(typeof closeMapInventoryOverlay==="function"){
        const previousCloseMapInventoryOverlay=closeMapInventoryOverlay;
        closeMapInventoryOverlay=function(){
            const inventoryPage=document.getElementById("inventoryPage");
            if(inventoryPage){
                inventoryPage.classList.remove("v169-dungeon-inventory-overlay");
            }
            return previousCloseMapInventoryOverlay.apply(this,arguments);
        };
    }
})();


/* bundled source: js/equipment-progression.js */
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
        {key:"white",label:"白階",chance:40,min:1,max:3,reforgeSlots:0,shopPrice:500,color:"#D8D8D8",available:true},
        {key:"blue",label:"藍階",chance:40,min:4,max:6,reforgeSlots:0,shopPrice:1500,color:"#42A5FF",available:true},
        {key:"purple",label:"紫階",chance:15,min:7,max:9,reforgeSlots:1,shopPrice:4000,color:"#B05CFF",available:true},
        {key:"orange",label:"橙階",chance:5,min:10,max:12,reforgeSlots:1,shopPrice:10000,color:"#FF9F38",available:true},
        {key:"pink",label:"桃紅階",chance:0,available:false,planned:true,color:"#FF4FA7"},
        {key:"four-symbol",label:"四象階",chance:0,available:false,planned:true,fourSymbol:true,color:null}
    ];
    const RARITY_BY_KEY=Object.fromEntries(RARITIES.map(item=>[item.key,item]));
    const EQUIPMENT_CHEST_DROP_TABLE=[
        {key:"white",label:"白階",chance:40},
        {key:"blue",label:"藍階",chance:40},
        {key:"purple",label:"紫階",chance:10},
        {key:"orange",label:"橙階",chance:10}
    ];
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",spirit:"精神",energy:"能量"};
    const SLOT_META={
        shoulder:{label:"護腕",warrior:["vitality","attack"],mage:["vitality","intelligence"]},
        head:{label:"頭盔",warrior:["vitality","attack","agility"],mage:["vitality","intelligence","agility"]},
        shoes:{label:"鞋子",warrior:["vitality","agility","attack"],mage:["vitality","agility","intelligence"]},
        armor:{label:"衣服",warrior:["vitality","agility","attack"],mage:["vitality","agility","intelligence"]},
        weapon:{label:"武器",warrior:["attack"],mage:["intelligence"]}
    };
    const ASSETS={
        warrior:{
            shoulder:["assets/equipment/warrior/bracer-01.png","assets/equipment/warrior/bracer-02.png"],
            head:["assets/equipment/warrior/head-01.png","assets/equipment/warrior/head-02.png"],
            armor:["assets/equipment/warrior/armor-01.png","assets/equipment/warrior/armor-02.png"],
            shoes:["assets/equipment/warrior/shoes-01.png","assets/equipment/warrior/shoes-02.png"],
            weapon:["assets/equipment/warrior/weapon-01.png","assets/equipment/warrior/weapon-02.png","assets/equipment/warrior/weapon-03.png","assets/equipment/warrior/weapon-04.png"]
        },
        mage:{
            shoulder:["assets/equipment/mage/bracer-01.png","assets/equipment/mage/bracer-02.png"],
            head:["assets/equipment/mage/head-01.png","assets/equipment/mage/head-02.png"],
            armor:["assets/equipment/mage/armor-01.png","assets/equipment/mage/armor-02.png"],
            shoes:["assets/equipment/mage/shoes-01.png","assets/equipment/mage/shoes-02.png"],
            weapon:["assets/equipment/mage/weapon-01.png","assets/equipment/mage/weapon-02.png","assets/equipment/mage/weapon-03.png","assets/equipment/mage/weapon-04.png"]
        }
    };
    const NAME_PREFIX={
        white:["素鐵","粗革","舊紋","樸木","灰鋼","素麻"],
        blue:["青鋼","凝霜","玄紋","碧影","寒星","靈木"],
        purple:["紫霞","幽月","星隕","玄冥","流光","凌霄"],
        orange:["日曜","龍炎","天衡","帝曜","神鑄","無極"]
    };
    const NAME_SUFFIX={
        warrior:{shoulder:"戰腕",head:"戰盔",armor:"戰甲",shoes:"戰靴",weapon:"戰刃"},
        mage:{shoulder:"法環",head:"法冠",armor:"法袍",shoes:"法履",weapon:"法杖"}
    };
    const SET_RULES={
        blade:{stats:{attack:15,vitality:-2}},
        fan:{stats:{intelligence:15,vitality:-2}},
        heavyArmor:{stats:{attack:7,spirit:5}},
        robe:{stats:{intelligence:7,spirit:5}},
        boots:{stats:{attack:2,agility:13}},
        shoes:{stats:{intelligence:2,agility:13}},
        helm:{stats:{attack:15}},
        crown:{stats:{intelligence:15}},
        wristguard:{stats:{attack:15}},
        focus:{stats:{intelligence:15}}
    };
    const SET_IDS=new Set(["setFire","setWater","setEarth","setWind"]);
    const SHOP_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("equipment-shop-daily");
    let activeReforgeSnapshot=null;
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
    function rarityFromRandom(random=Math.random){
        const roll=random()*100;
        let cursor=0;
        for(const rarity of RARITIES){ cursor+=rarity.chance; if(roll<cursor){ return rarity; } }
        return RARITIES[RARITIES.length-1];
    }
    function artMarkup(path,rarityKey){
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarityKey+'"><img src="'+path+'" alt="" draggable="false" onerror="this.hidden=true"></span>';
    }
    const LEGACY_STARTER_EQUIPMENT_ART={
        ironSword:{path:"assets/equipment/warrior/weapon-01.png",classType:"warrior"},
        woodStaff:{path:"assets/equipment/mage/weapon-01.png",classType:"mage"},
        leatherHelmet:{path:"assets/equipment/warrior/head-01.png"},
        leatherArmor:{path:"assets/equipment/warrior/armor-01.png"},
        leatherShoes:{path:"assets/equipment/warrior/shoes-01.png"},
        powerRing:{ring:true}
    };
    /* V173.62: starter whites obey the same 1–3 single-stat band as ordinary white drops/shop gear. */
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
    function assetVariant(classType,slot,random){
        const list=ASSETS[classType]&&ASSETS[classType][slot]||[];
        return list.length?list[Math.floor(random()*list.length)%list.length]:"";
    }
    function mageWeaponSuffix(asset){
        const source=String(asset||"");
        return /weapon-(?:03|04)\.png(?:\?|$)/i.test(source)?"法扇":"法杖";
    }
    function generatedName(rarity,classType,slot,random,asset){
        const prefixes=NAME_PREFIX[rarity.key];
        const prefix=prefixes[Math.floor(random()*prefixes.length)%prefixes.length];
        const suffix=classType==="mage"&&slot==="weapon"
            ?mageWeaponSuffix(asset)
            :NAME_SUFFIX[classType][slot];
        return prefix+suffix;
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
        const rarity=forcedRarity&&forcedRarity.available!==false?forcedRarity:rarityFromRandom(random);
        const classType=forced.classType||(random()<.5?"warrior":"mage");
        const slots=Object.keys(SLOT_META);
        const slot=forced.slot||slots[Math.floor(random()*slots.length)%slots.length];
        const statPool=SLOT_META[slot][classType];
        const stat=forced.stat||statPool[Math.floor(random()*statPool.length)%statPool.length];
        const value=forced.value==null?randomInt(rarity.min,rarity.max,random):Number(forced.value);
        const asset=assetVariant(classType,slot,random);
        const name=generatedName(rarity,classType,slot,random,asset);
        return {
            id:makeUid("gear"),v141Uid:makeUid("gearuid"),name,
            icon:artMarkup(asset,rarity.key),type:slot,count:1,price:Math.floor(rarity.shopPrice*.2),
            stats:{[stat]:value},reforgeStats:null,reforgeSlots:rarity.reforgeSlots,reforgeUsed:0,
            rarityKey:rarity.key,quality:rarity.key,classType,assetPath:asset,
            shopPrice:rarity.shopPrice,v17346GeneratedEquipment:true
        };
    }
    window.v17346GenerateEquipment=generateEquipment;
    window.v17346EquipmentRarityTable=RARITIES.map(item=>({...item}));

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

    function setPieceKey(item){
        const id=String(item&&item.id||"");
        return Object.keys(SET_RULES).find(key=>id.endsWith("_"+key))||null;
    }
    function addOrangeClass(icon){
        if(typeof icon!=="string"||icon.includes("v17346-rarity-orange")){ return icon; }
        return icon.replace(/class="([^"]*v169-item-art[^"]*)"/,(_m,classes)=>'class="'+classes+' v17346-rarity-orange"');
    }
    function applySetRule(item){
        if(!item||!SET_IDS.has(item.setId)){ return item; }
        const key=setPieceKey(item);
        if(!key){ return item; }
        item.stats={...SET_RULES[key].stats};
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
        if(!item){ return 0; }
        const explicit=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));
        const existing=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;
        return Math.max(explicit,existing);
    }
    window.v17346RemainingReforgeSlots=remainingReforgeSlots;

    function appendReforgeMarkers(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats){ return; }
        stats.querySelectorAll(".v17346-reforge-slot").forEach(node=>node.remove());
        const count=remainingReforgeSlots(item);
        for(let index=0;index<count;index++){
            stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot">[可冶煉]</div>');
        }
    }
    function configureEquipmentChestModal(item){
        if(!item||item.id!==EQUIPMENT_CHEST_DEFINITION.id){ return; }
        const modal=document.getElementById("itemModal");
        const equipButton=document.getElementById("itemEquipButton");
        const sellButton=document.querySelector("#itemModal .sell-button");
        const useButton=document.getElementById("v132ItemUseButton");
        const previewButton=document.getElementById("v132ItemPreviewButton");
        if(modal){ modal.classList.remove("v17346-potion-detail"); }
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
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.toggle("v17346-potion-detail",!!(item&&item.type==="potion")); }
            if(item){ applySetRule(item); appendReforgeMarkers(item); configureEquipmentChestModal(item); }
            return result;
        };
    }
    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            syncMainCharacterEquipmentStorage();
            const result=previousOpenEquippedItem.apply(this,arguments);
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v17346-potion-detail"); }
            if(item){ applySetRule(item); appendReforgeMarkers(item); }
            return result;
        };
    }
    if(typeof closeItemModal==="function"){
        const previousCloseItemModal=closeItemModal;
        closeItemModal=function(){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v17346-potion-detail"); }
            return previousCloseItemModal.apply(this,arguments);
        };
    }

    function allEquipment(){
        const result=[];
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){ result.push(...inventoryItems); }
        if(typeof characterEquipment!=="undefined"&&characterEquipment){ Object.values(characterEquipment).forEach(slots=>result.push(...Object.values(slots||{}))); }
        return result.filter(Boolean);
    }
    function selectedReforgeItem(){
        const select=document.querySelector('select[onchange*="v141SelectReforgeItem"]');
        const uid=select&&select.value;
        return uid?allEquipment().find(item=>item&&item.v141Uid===uid)||null:null;
    }
    if(typeof window.v141StartReforge==="function"){
        const previousStartReforge=window.v141StartReforge;
        window.v141StartReforge=function(){
            const item=selectedReforgeItem();
            if(!item||remainingReforgeSlots(item)<=0){
                if(typeof window.rpgAlert==="function"){ void window.rpgAlert("這件裝備沒有冶煉槽。",{title:"無法冶煉"}); }
                else{ alert("這件裝備沒有冶煉槽。"); }
                return false;
            }
            return previousStartReforge.apply(this,arguments);
        };
    }
    if(typeof window.v141ResolveReforge==="function"){
        const previousResolveReforge=window.v141ResolveReforge;
        window.v141ResolveReforge=function(){
            // V173.58: replacement semantics live in js/36. No additive merge and
            // no reforgeUsed attempt consumption here.
            return previousResolveReforge.apply(this,arguments);
        };
    }

    function injectStyles(){
        if(document.getElementById("equipment-progression-style")){ return; }
        const style=document.createElement("style");
        style.id="equipment-progression-style";
        style.textContent=`
.v17346-rarity-white{border:2px solid #D8D8D8!important;box-shadow:0 0 7px rgba(216,216,216,.55)!important}
.v17346-rarity-blue{border:2px solid #42A5FF!important;box-shadow:0 0 9px rgba(66,165,255,.7)!important}
.v17346-rarity-purple{border:2px solid #B05CFF!important;box-shadow:0 0 10px rgba(176,92,255,.75)!important}
.v17346-rarity-orange{border:3px solid #FF9F38!important;box-shadow:0 0 5px #FF9F38,0 0 14px rgba(255,159,56,.9),inset 0 0 8px rgba(255,159,56,.3)!important}
.v17346-rarity-pink{border:3px solid #FF4FA7!important;box-shadow:0 0 6px #FF4FA7,0 0 16px rgba(255,79,167,.88),inset 0 0 9px rgba(255,79,167,.42)!important}
.v17346-rarity-four-symbol{border:3px solid transparent!important;background:linear-gradient(#090807,#090807) padding-box,conic-gradient(from 0deg,#42A5FF 0 25%,#47D6A3 25% 50%,#C89B45 50% 75%,#FF5A36 75% 100%) border-box!important;box-shadow:0 0 8px rgba(255,90,54,.34),0 0 12px rgba(66,165,255,.32),0 0 16px rgba(71,214,163,.26)!important;animation:v17360FourSymbolRarityBreath 2.8s ease-in-out infinite!important}
@keyframes v17360FourSymbolRarityBreath{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.14)}}
.v17346-reforge-slot{margin-top:7px;color:#ffbf5b!important;font-weight:900;letter-spacing:.06em}
#game-stage #itemModal.v17346-potion-detail .item-modal-box{height:auto!important;min-height:0!important;max-height:calc(100% - 28px)!important;flex:0 0 auto!important;align-self:center!important;justify-content:flex-start!important}
#game-stage #itemModal.v17346-potion-detail #itemModalStats{flex:0 0 auto!important;min-height:0!important;max-height:180px!important}
#game-stage #itemModal.v17346-potion-detail .item-modal-buttons{margin-top:0!important}
#game-stage #itemModal #v17342InventoryPotionUse{-webkit-appearance:none!important;appearance:none!important;background:linear-gradient(180deg,#d9ad55 0%,#9c641c 100%)!important;border:1px solid #f2cf83!important;color:#1a1007!important;opacity:1!important;font-weight:900!important;text-shadow:none!important;box-shadow:inset 0 1px 0 rgba(255,242,192,.42),0 3px 8px rgba(0,0,0,.34)!important}
#game-stage #itemModal #v17342InventoryPotionUse:focus,#game-stage #itemModal #v17342InventoryPotionUse:focus-visible,#game-stage #itemModal #v17342InventoryPotionUse:active{background:linear-gradient(180deg,#edc66d 0%,#ad7524 100%)!important;color:#160d05!important;outline:2px solid rgba(255,220,139,.72)!important;outline-offset:1px!important}
#game-stage #itemModal #v17342InventoryPotionUse:disabled{background:#33291f!important;border-color:#66533d!important;color:#8f806b!important;box-shadow:none!important;opacity:.68!important}
.v132-reward-modal-inner.v17346-preview-modal{width:min(360px,calc(100% - 24px))!important;height:min(540px,calc(100dvh - 24px))!important;max-height:calc(100dvh - 24px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:16px!important;box-sizing:border-box!important}
.v132-reward-modal-inner.v17346-preview-modal>h3{position:static!important;flex:0 0 auto!important;margin:0 0 12px!important;padding:0!important;background:transparent!important}
.v132-reward-modal-inner.v17346-preview-modal .v132-preview-list-scroll{flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;touch-action:pan-y;scrollbar-gutter:stable}
.v132-reward-modal-inner.v17346-preview-modal .v132-reward-actions{position:static!important;flex:0 0 auto!important;margin-top:12px!important;padding-top:0!important;background:transparent!important}
.v17346-shop-card{position:relative;overflow:hidden;padding:10px 9px 9px!important;cursor:pointer;transition:filter .16s ease,background .16s ease,border-color .16s ease}.v17346-shop-card .v17346-gear-art{width:74px;height:74px;margin:0 auto 7px}.v17346-gear-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-card .v17346-shop-name{display:block;color:#f6e7c2!important;font-size:17px!important;line-height:1.22!important;font-weight:900!important;letter-spacing:.02em}.v17346-shop-card .v17346-shop-slot{display:block;margin-top:3px;color:#c9b894!important;font-size:14px!important;line-height:1.25!important}.v17346-shop-card .v17346-stat{display:block;margin-top:3px;color:#ffe0a0!important;font-size:15px!important;line-height:1.3!important;font-weight:800!important}.v17346-shop-card .v17346-reforge-mini{display:block;margin-top:2px;color:#ffbf5b;font-size:12px;font-weight:800}.v17346-shop-card .v17346-shop-buy{-webkit-appearance:none;appearance:none;width:100%;min-height:42px;margin-top:8px;border:1px solid rgba(226,181,87,.76);border-radius:7px;font-size:15px;font-weight:900;line-height:1.15}.v17346-shop-card.is-affordable{background:linear-gradient(180deg,rgba(51,36,19,.94),rgba(19,14,10,.96))!important;box-shadow:inset 0 0 0 1px rgba(225,179,83,.08),0 0 10px rgba(211,155,54,.08)}.v17346-shop-card.is-affordable .v17346-shop-buy{background:linear-gradient(180deg,#f4d477 0%,#cf942d 58%,#a76518 100%)!important;border-color:#ffe5a0!important;color:#241506!important;text-shadow:0 1px rgba(255,239,185,.35)!important;box-shadow:inset 0 1px 0 rgba(255,248,211,.62),0 0 10px rgba(236,183,71,.32)!important}.v17346-shop-card.is-affordable .v17346-shop-buy:active{background:linear-gradient(180deg,#fff0ad,#d69a32)!important;color:#160d05!important}.v17346-shop-card.is-unaffordable{background:linear-gradient(180deg,rgba(38,29,24,.94),rgba(17,14,12,.98))!important;border-color:rgba(119,83,61,.72)!important}.v17346-shop-card.is-unaffordable .v17346-gear-art img{filter:saturate(.48) brightness(.72)}.v17346-shop-card.is-unaffordable .v17346-shop-name{color:#b9aa98!important}.v17346-shop-card.is-unaffordable[data-rarity="orange"] .v17346-shop-name{color:#d7944d!important}.v17346-shop-card.is-unaffordable .v17346-shop-slot,.v17346-shop-card.is-unaffordable .v17346-stat{color:#978878!important}.v17346-shop-card .v17346-shop-buy:disabled{background:linear-gradient(180deg,rgba(91,43,31,.82),rgba(48,27,23,.92))!important;border-color:rgba(167,79,56,.7)!important;color:#d79279!important;box-shadow:none!important;opacity:.86!important;cursor:not-allowed}.v17346-shop-preview-modal{width:min(340px,calc(100% - 26px))!important;max-height:calc(100dvh - 30px)!important;padding:18px!important;box-sizing:border-box!important;text-align:center!important}.v17346-shop-preview-modal>h3{margin:0 0 12px!important;color:#f7e7be!important;font-size:22px!important;line-height:1.25!important}.v17346-shop-preview-art{width:168px;height:168px;margin:0 auto 14px;display:grid;place-items:center}.v17346-shop-preview-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-preview-info{display:grid;gap:7px;padding:11px 12px;border:1px solid rgba(197,151,72,.55);border-radius:9px;background:rgba(12,9,6,.7);font-size:16px}.v17346-shop-preview-info strong{color:#ffe09a;font-size:18px}.v17346-shop-preview-price{margin-top:11px;color:#ffd078;font-size:18px;font-weight:900}.v17346-shop-preview-reforge{margin-top:6px;color:#ffbf5b;font-weight:900}.v17346-shop-preview-modal .v132-reward-actions{margin-top:14px!important}.v17346-equipment-dungeon-card .v141-dungeon-cover-art{background-image:linear-gradient(rgba(5,4,3,.2),rgba(5,4,3,.68)),url('assets/ui/dungeon-equipment-v17346.png')!important;background-size:cover!important;background-position:center!important}
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
        try{ const stored=JSON.parse(localStorage.getItem(SHOP_STORAGE_KEY)||"{}"); return stored&&stored.date===today?{date:today,refreshCount:Math.max(0,Math.min(10,Math.floor(Number(stored.refreshCount)||0)))}:{date:today,refreshCount:0}; }catch(_){ return {date:today,refreshCount:0}; }
    }
    function currentShopOffers(){
        const state=shopState();
        return Array.from({length:6},(_,index)=>generateEquipment(seededRandom(state.date+":"+state.refreshCount+":"+index)));
    }
    function statLine(item){
        const [key,value]=Object.entries(item.stats||{})[0]||["",0];
        return (STAT_LABEL[key]||key)+(Number(value)>=0?" +":" ")+value;
    }
    window.v17346PreviewEquipmentShopOffer=function(index){
        const safeIndex=Math.max(0,Math.min(5,Math.floor(Number(index)||0)));
        const item=currentShopOffers()[safeIndex];
        if(!item||typeof window.v132ShowRewardModal!=="function"){ return; }
        const rarity=RARITY_BY_KEY[item.rarityKey]||RARITIES[0];
        const html='<div class="v132-reward-modal-inner v17346-shop-preview-modal" data-rarity="'+escapeHtml(item.rarityKey)+'"><h3>'+escapeHtml(item.name)+'</h3><div class="v17346-shop-preview-art">'+item.icon+'</div><div class="v17346-shop-preview-info"><span>'+escapeHtml(SLOT_META[item.type].label)+'</span><strong>'+escapeHtml(statLine(item))+'</strong></div><div class="v17346-shop-preview-price">'+rarity.shopPrice.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };
    function replaceEquipmentShop(){
        const root=document.querySelector("#homeFeatureModalBody .v17345-equipment-shop");
        if(!root){ return; }
        const state=shopState();
        const offers=currentShopOffers();
        const freeRemaining=Math.max(0,5-state.refreshCount);
        const currentGold=typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)):0;
        const goldText=currentGold.toLocaleString("zh-TW");
        root.innerHTML='<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+goldText+'</b></div><div class="v17345-equipment-grid">'+offers.map((item,index)=>{
            const rarity=RARITY_BY_KEY[item.rarityKey];
            const canBuy=currentGold>=rarity.shopPrice;
            return '<article class="v17345-equipment-card v17346-shop-card '+(canBuy?'is-affordable':'is-unaffordable')+'" data-rarity="'+escapeHtml(item.rarityKey)+'" role="button" tabindex="0" aria-label="預覽 '+escapeHtml(item.name)+'" onclick="v17346PreviewEquipmentShopOffer('+index+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();v17346PreviewEquipmentShopOffer('+index+')}"><div class="v17345-equipment-icon v17346-gear-art">'+item.icon+'</div><b class="v17346-shop-name">'+escapeHtml(item.name)+'</b><span class="v17346-shop-slot">'+escapeHtml(SLOT_META[item.type].label)+'</span><span class="v17346-stat">'+escapeHtml(statLine(item))+'</span>'+(item.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy" type="button" '+(canBuy?'onclick="event.stopPropagation();v17346BuyEquipmentShopOffer('+index+')"':'disabled aria-disabled="true"')+'>'+rarity.shopPrice.toLocaleString("zh-TW")+' 金幣</button></article>';
        }).join("")+'</div><div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / 10</b><span>前5次免費；第6～10次尚未開放。</span></div><button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+(freeRemaining>0?'免費刷新（剩'+freeRemaining+'次）':'免費刷新已用完')+'</button></div>';
    }
    window.v17346BuyEquipmentShopOffer=function(index){
        const item=currentShopOffers()[Math.max(0,Math.min(5,Math.floor(Number(index)||0)))];
        if(!item){ return; }
        const cost=Math.max(0,Number(item.shopPrice)||0);
        if(typeof gold==="undefined"||Number(gold)<cost){ void (window.rpgAlert?window.rpgAlert("金幣不足。",{title:"無法購買"}):Promise.resolve()); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        gold-=cost;
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){ inventoryItems.push({...item}); }
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof saveGame==="function"){ saveGame(); }
        replaceEquipmentShop();
        if(window.rpgAlert){ void window.rpgAlert("已購買「"+item.name+"」。",{title:"購買成功",tone:"success"}); }
    };
    if(typeof window.v169SwitchShopPage==="function"){
        const previousSwitch=window.v169SwitchShopPage;
        window.v169SwitchShopPage=function(page){ const result=previousSwitch.apply(this,arguments); if(page==="equipment"){ replaceEquipmentShop(); } return result; };
    }
    if(typeof window.v17345RefreshEquipmentShop==="function"){
        const previousRefresh=window.v17345RefreshEquipmentShop;
        window.v17345RefreshEquipmentShop=function(){ const result=previousRefresh.apply(this,arguments); replaceEquipmentShop(); return result; };
    }

    function showEquipmentReward(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner"><h3>裝備副本挑戰成功！</h3><p>獲得裝備寶箱 ×2；每個寶箱開啟後隨機獲得3件裝備。</p><p>'+escapeHtml(equipmentChestOddsText("・"))+'</p><div class="v132-reward-actions"><button type="button" onclick="v17346ClaimEquipmentDungeon(false)">直接領取</button><button type="button" onclick="v17346ClaimEquipmentDungeon(true)">看廣告雙倍領取</button></div></div>';
        window.v132ShowRewardModal(html);
    }
    window.v17346ClaimEquipmentDungeon=function(doubled){
        const grant=multiplier=>{
            const chestCount=2*Math.max(1,Math.floor(Number(multiplier)||1));
            if(typeof window.v132AddItemToInventory!=="function"){
                alert("裝備寶箱系統尚未就緒，請重新整理後再試。");
                return;
            }
            if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(EQUIPMENT_CHEST_DEFINITION,chestCount)){
                alert("背包空間不足，裝備寶箱尚未領取；請先整理背包後再試。");
                return;
            }
            if(!window.v132AddItemToInventory(EQUIPMENT_CHEST_DEFINITION,chestCount)){
                alert("裝備寶箱寫入失敗，請先整理背包後再試。");
                return;
            }
            syncEquipmentChestPresentation();
            if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
            if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
            if(typeof saveGame==="function"){ saveGame(); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            if(typeof window.rpgAlert==="function"){
                void window.rpgAlert("獲得裝備寶箱×"+chestCount+"，請到背包自行開啟。",{title:"裝備副本獎勵",confirmText:"知道了",tone:"success"});
            }
            if(typeof showPage==="function"){ showPage("dungeon"); }
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
        };
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{
            grant(1);
        }
    };

    async function beginEquipmentDungeon(){
        if(equipmentDungeonRunning||typeof window.v148BuildDailyDungeonWaves!=="function"||typeof window.v132LaunchDungeonBattle!=="function"){ return; }
        const built=window.v148BuildDailyDungeonWaves("gold");
        const waves=built&&built.waves||[];
        if(waves.length!==3){ return; }
        const accepted=window.rpgConfirm?await window.rpgConfirm("裝備副本共3輪，每輪6名敵人。\n勝利後獲得2個裝備寶箱，寶箱會放入背包；每箱開啟後隨機獲得3件裝備。\n是否開始挑戰？",{title:"裝備副本",confirmText:"開始挑戰"}):true;
        if(!accepted){ return; }
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
            });
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


/* bundled source: js/53-v173.50-inventory-qol.js */
/* =====================================================
   V173.50 — inventory quality-of-life
   - equipment bulk sell by rarity threshold
   - batch use/open for stacked potions, chests and tickets
   - no duplicate business rules: reuse existing inventory/content authorities
===================================================== */
(function installV17350InventoryQol(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v17350InventoryQolInstalled){ return; }
    window.__v17350InventoryQolInstalled=true;

    const BULK_SELL_KEY=window.FourSymbolsAccountSave.accountKey("bulk-sell-quality");
    const EQUIPMENT_TYPES=new Set(["head","shoulder","shoes","weapon","hand","armor"]);
    const QUALITY_ORDER=["white","blue","purple","orange","pink","four-symbol"];
    const QUALITY_LABEL={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};
    const TIER_TO_QUALITY={white:"white",blue:"blue",purple:"purple",orange:"orange",pink:"pink","four-symbol":"four-symbol",low:"white",mid:"blue",high:"purple",perfect:"orange"};
    const SUPPORTED_BATCH_CHEST_IDS=new Set(["materialChest","equipmentChest"]);

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function clampInteger(value,min,max){
        const numeric=Math.floor(Number(value)||0);
        return Math.max(min,Math.min(max,numeric));
    }

    function ownedCountById(itemId){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return 0; }
        return inventoryItems.reduce((sum,item)=>{
            if(!item||item.id!==itemId){ return sum; }
            return sum+Math.max(1,Math.floor(Number(item.count)||1));
        },0);
    }

    function equipmentQuality(item){
        if(!item){ return null; }
        const direct=String(item.rarityKey||item.quality||"").toLowerCase();
        if(QUALITY_ORDER.includes(direct)){ return direct; }
        const tier=String(item.tierKey||"").toLowerCase();
        if(TIER_TO_QUALITY[tier]){ return TIER_TO_QUALITY[tier]; }
        if(isInventoryEquipment(item)&&item.setId){ return "orange"; }
        const icon=String(item.icon||"");
        for(const quality of QUALITY_ORDER){
            if(icon.includes("rarity-"+quality)){ return quality; }
        }
        return null;
    }

    function isInventoryEquipment(item){
        if(!item){ return false; }
        if(typeof isEquipmentInventoryType==="function"){
            try{ return !!isEquipmentInventoryType(item.type); }catch(_){ }
        }
        return EQUIPMENT_TYPES.has(String(item.type||""));
    }

    const V17362_STACK_LIMIT=999;

    function inventoryQualityRank(item){
        const quality=equipmentQuality(item);
        const rank=QUALITY_ORDER.indexOf(quality);
        return rank>=0?rank:-1;
    }

    function inventoryFamilyKey(item){
        if(!item){ return "zz:unknown"; }
        const id=String(item.id||"");
        const type=String(item.type||"item");
        if(isInventoryEquipment(item)){
            const slot=type==="hand"?"weapon":type==="helmet"?"head":type;
            return "equipment:"+String(item.classType||"any")+":"+slot;
        }
        if(item.blueprintSlot){ return "material:blueprint:"+String(item.blueprintSlot); }
        if(/^ore/i.test(id)){ return "material:ore"; }
        if(item.talismanEffect){ return "talisman:"+String(item.talismanEffect); }
        if(type==="potion"){ return "potion:"+id; }
        if(type==="chest"){ return "chest:"+id; }
        if(type==="ticket"){ return "ticket:"+String(item.setId||id); }
        return type+":"+(id||String(item.name||""));
    }

    /*
       Stack identity is intentionally stricter than the visual family key.
       Equipment is never stackable. For materials, the displayed material
       name is the durable semantic identity: older saves can carry a legacy
       id while the current definition uses a newer stable id, which used to
       leave two visually identical material stacks forever. Other item types
       keep their stable id identity so tickets/chests/potions with different
       behavior are never accidentally merged merely because labels match.
    */
    function inventoryStackIdentity(item){
        if(!item||isInventoryEquipment(item)){ return null; }
        const type=String(item.type||"item");
        const id=String(item.id||"");
        if(type==="material"){
            const name=String(item.name||"").trim();
            if(name){ return "material::name::"+name; }
        }
        return type+"::id::"+(id||String(item.name||""));
    }

    function cloneInventoryStack(item,count){
        const copy={...item,count};
        if(item.stats&&typeof item.stats==="object"){ copy.stats={...item.stats}; }
        if(item.reforgeStats&&typeof item.reforgeStats==="object"){ copy.reforgeStats={...item.reforgeStats}; }
        return copy;
    }

    function normalizeInventoryStacksAndOrder(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return false; }
        const source=inventoryItems.filter(Boolean);
        const familyOrder=new Map();
        let nextFamily=0;
        source.forEach(item=>{
            const family=inventoryFamilyKey(item);
            if(!familyOrder.has(family)){ familyOrder.set(family,nextFamily++); }
        });

        const exactStacks=new Map();
        const output=[];
        source.forEach((item,index)=>{
            if(isInventoryEquipment(item)){
                if(Number(item.count)!==1){ item.count=1; }
                output.push(item);
                return;
            }
            const stackKey=inventoryStackIdentity(item);
            if(!stackKey){
                let remaining=Math.max(1,Math.floor(Number(item.count)||1));
                while(remaining>0){
                    const amount=Math.min(V17362_STACK_LIMIT,remaining);
                    output.push(cloneInventoryStack(item,amount));
                    remaining-=amount;
                }
                return;
            }
            let entry=exactStacks.get(stackKey);
            if(!entry){
                entry={template:item,total:0,first:index};
                exactStacks.set(stackKey,entry);
            }
            entry.total+=Math.max(1,Math.floor(Number(item.count)||1));
        });
        exactStacks.forEach(entry=>{
            let remaining=entry.total;
            while(remaining>0){
                const amount=Math.min(V17362_STACK_LIMIT,remaining);
                output.push(cloneInventoryStack(entry.template,amount));
                remaining-=amount;
            }
        });

        output.sort((a,b)=>{
            const qualityDiff=inventoryQualityRank(b)-inventoryQualityRank(a);
            if(qualityDiff){ return qualityDiff; }
            const familyA=inventoryFamilyKey(a);
            const familyB=inventoryFamilyKey(b);
            const familyDiff=(familyOrder.get(familyA)??999999)-(familyOrder.get(familyB)??999999);
            if(familyDiff){ return familyDiff; }
            const idDiff=String(a.id||"").localeCompare(String(b.id||""),"zh-Hant");
            if(idDiff){ return idDiff; }
            return String(a.name||"").localeCompare(String(b.name||""),"zh-Hant");
        });

        const changed=output.length!==inventoryItems.length||output.some((item,index)=>{
            const previous=inventoryItems[index];
            return previous!==item||Number(previous&&previous.count)!==Number(item.count);
        });
        if(changed){
            inventoryItems.splice(0,inventoryItems.length,...output);
        }
        return changed;
    }

    window.v17362NormalizeInventoryStacksAndOrder=normalizeInventoryStacksAndOrder;
    window.v17362InventoryFamilyKey=inventoryFamilyKey;
    window.v17362InventoryStackIdentity=inventoryStackIdentity;

    /* Normalize old saves immediately, then again whenever the inventory grid is rebuilt. */
    normalizeInventoryStacksAndOrder();
    if(typeof rebuildInventorySlots==="function"&&!rebuildInventorySlots.__v17362Normalized){
        const previousRebuildInventorySlots=rebuildInventorySlots;
        const normalizedRebuild=function(){
            normalizeInventoryStacksAndOrder();
            return previousRebuildInventorySlots.apply(this,arguments);
        };
        normalizedRebuild.__v17362Normalized=true;
        rebuildInventorySlots=normalizedRebuild;
        window.rebuildInventorySlots=normalizedRebuild;
    }

    function readBulkSellThreshold(){
        let stored="white";
        try{ stored=localStorage.getItem(BULK_SELL_KEY)||"white"; }catch(_){ }
        return QUALITY_ORDER.includes(stored)?stored:"white";
    }

    function writeBulkSellThreshold(value){
        const quality=QUALITY_ORDER.includes(value)?value:"white";
        try{ localStorage.setItem(BULK_SELL_KEY,quality); }catch(_){ }
        return quality;
    }

    function bulkSellCandidates(threshold){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return []; }
        const maxRank=QUALITY_ORDER.indexOf(threshold);
        if(maxRank<0){ return []; }
        return inventoryItems.filter(item=>{
            if(!isInventoryEquipment(item)){ return false; }
            const quality=equipmentQuality(item);
            const rank=QUALITY_ORDER.indexOf(quality);
            /* Unknown/future rarities are deliberately excluded rather than guessed. */
            return rank>=0&&rank<=maxRank;
        });
    }

    function candidateSummary(threshold){
        const candidates=bulkSellCandidates(threshold);
        let units=0;
        let goldValue=0;
        let hasOrangeOrAbove=false;
        candidates.forEach(item=>{
            const count=Math.max(1,Math.floor(Number(item.count)||1));
            units+=count;
            goldValue+=Math.max(0,Math.floor(Number(item.price)||0))*count;
            const rank=QUALITY_ORDER.indexOf(equipmentQuality(item));
            if(rank>=QUALITY_ORDER.indexOf("orange")){ hasOrangeOrAbove=true; }
        });
        return {candidates,units,goldValue,hasOrangeOrAbove};
    }

    function refreshInventoryViews(){
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(typeof renderInventory==="function"){ renderInventory(); }
        else if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
    }

    function ensureBulkSellBar(){
        const gridScroll=document.getElementById("inventoryGridScroll");
        if(!gridScroll||!gridScroll.parentNode){ return; }
        let bar=document.getElementById("v17350BulkSellBar");
        if(!bar){
            bar=document.createElement("section");
            bar.id="v17350BulkSellBar";
            bar.className="v17350-bulk-sell-bar";
            bar.setAttribute("aria-label","裝備一鍵售出");
            bar.innerHTML=
                '<b>一鍵售出</b>'+
                '<select id="v17350BulkSellQuality" aria-label="售出品質上限">'+
                    '<option value="white">白階以下</option>'+
                    '<option value="blue">藍階以下</option>'+
                    '<option value="purple">紫階以下</option>'+
                    '<option value="orange">橙階以下</option>' +
                    '<option value="pink">桃紅階以下</option>' +
                    '<option value="four-symbol">四象階以下</option>'+
                '</select>'+
                '<button id="v17350BulkSellButton" type="button" onclick="v17350BulkSellEquipment()">售出 0 件</button>'+
                '<small id="v17350BulkSellMeta">僅售出背包內未穿戴裝備</small>';
            gridScroll.parentNode.insertBefore(bar,gridScroll);
            const select=bar.querySelector("#v17350BulkSellQuality");
            if(select){
                select.value=readBulkSellThreshold();
                select.addEventListener("change",()=>{
                    writeBulkSellThreshold(select.value);
                    syncBulkSellBar();
                });
            }
        }
        syncBulkSellBar();
    }

    function syncBulkSellBar(){
        const bar=document.getElementById("v17350BulkSellBar");
        if(!bar){ return; }
        const visible=typeof inventoryFilter!=="undefined"&&inventoryFilter==="equipment";
        bar.hidden=!visible;
        if(!visible){ return; }
        const select=bar.querySelector("#v17350BulkSellQuality");
        const threshold=select&&QUALITY_ORDER.includes(select.value)?select.value:readBulkSellThreshold();
        if(select&&!select.value){ select.value=threshold; }
        const summary=candidateSummary(threshold);
        const button=bar.querySelector("#v17350BulkSellButton");
        const meta=bar.querySelector("#v17350BulkSellMeta");
        if(button){
            button.disabled=summary.units<=0;
            button.textContent="售出 "+summary.units+" 件";
            button.classList.toggle("danger",summary.hasOrangeOrAbove);
        }
        if(meta){
            meta.textContent=summary.units>0
                ?"預計獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣"
                :"目前沒有符合條件的裝備";
        }
    }

    window.v17350BulkSellEquipment=async function(){
        const select=document.getElementById("v17350BulkSellQuality");
        const threshold=writeBulkSellThreshold(select&&select.value||readBulkSellThreshold());
        const summary=candidateSummary(threshold);
        if(summary.units<=0){
            if(typeof window.rpgAlert==="function"){
                await window.rpgAlert("目前沒有符合「"+QUALITY_LABEL[threshold]+"以下」條件的背包裝備。",{
                    title:"一鍵售出",confirmText:"知道了"
                });
            }
            return false;
        }

        if(summary.hasOrangeOrAbove){
            const accepted=typeof window.rpgConfirm==="function"&&await window.rpgConfirm(
                "這次一鍵售出包含橙階以上裝備。\n將售出 "+summary.units+" 件裝備，獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣。\n高階裝備售出後無法復原，確定繼續嗎？",
                {title:"高品質裝備警告",confirmText:"確認售出",cancelText:"取消",danger:true}
            );
            if(!accepted){ return false; }
        }

        const selected=new Set(summary.candidates);
        for(let index=inventoryItems.length-1;index>=0;index--){
            if(selected.has(inventoryItems[index])){ inventoryItems.splice(index,1); }
        }
        if(typeof gold!=="undefined"){ gold+=summary.goldValue; }
        if(typeof selectedInventorySlot!=="undefined"){ selectedInventorySlot=null; }
        if(typeof closeItemModal==="function"){ closeItemModal(); }
        refreshInventoryViews();
        ensureBulkSellBar();

        if(typeof window.rpgAlert==="function"){
            await window.rpgAlert(
                "已售出 "+summary.units+" 件裝備。\n獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣。",
                {title:"一鍵售出完成",confirmText:"知道了",tone:"success"}
            );
        }
        return true;
    };

    function getBatchDescriptor(item){
        if(!item){ return null; }
        const total=ownedCountById(item.id);
        if(total<=1){ return null; }
        if(typeof getPotionDefinition==="function"){
            const definition=getPotionDefinition(item.id);
            if(definition){ return {kind:"potion",label:"批量使用",total,definition}; }
        }
        if(item.type==="chest"&&SUPPORTED_BATCH_CHEST_IDS.has(String(item.id||""))){
            return {kind:"chest",label:"批量開啟",total};
        }
        if(item.type==="ticket"&&typeof window.useEquipmentTicket==="function"){
            return {kind:"ticket",label:"批量開啟",total};
        }
        return null;
    }

    function removeBatchActions(){
        const old=document.getElementById("v17350BatchAction");
        if(old){ old.remove(); }
    }

    function syncBatchActions(item){
        removeBatchActions();
        const descriptor=getBatchDescriptor(item);
        if(!descriptor){ return; }
        const buttons=document.querySelector("#itemModal .item-modal-buttons");
        if(!buttons||!buttons.parentNode){ return; }
        const panel=document.createElement("section");
        panel.id="v17350BatchAction";
        panel.className="v17350-batch-action";
        panel.dataset.itemId=String(item.id||"");
        panel.dataset.kind=descriptor.kind;
        panel.innerHTML=
            '<label for="v17350BatchQuantity">數量</label>'+
            '<input id="v17350BatchQuantity" type="number" inputmode="numeric" min="1" max="'+descriptor.total+'" value="'+descriptor.total+'" aria-label="批量數量">'+
            '<span class="v17350-batch-max">/ '+descriptor.total+'</span>'+
            '<button type="button" onclick="v17350RunBatchAction()">'+descriptor.label+'</button>';
        buttons.parentNode.insertBefore(panel,buttons);
        const input=panel.querySelector("#v17350BatchQuantity");
        if(input){
            const normalize=()=>{ input.value=String(clampInteger(input.value,1,descriptor.total)); };
            input.addEventListener("change",normalize);
            input.addEventListener("blur",normalize);
        }
    }

    function parseRewardLine(line,map){
        const text=String(line||"").trim();
        const match=text.match(/^(.*)×(\d+)$/);
        if(match){
            map.set(match[1],(map.get(match[1])||0)+Number(match[2]));
        }else if(text){
            map.set(text,(map.get(text)||0)+1);
        }
    }

    function formatRewardMap(map){
        return [...map.entries()].map(([name,count])=>name+"×"+count).join("、");
    }

    function batchPotion(item,requested){
        const definition=typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;
        const character=typeof getBackpackCharacter==="function"?getBackpackCharacter(inventoryCharacterIndex):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(inventoryCharacterIndex):null;
        if(!definition||!character||!stats){ return {used:0,message:"目前無法使用這項補品。"}; }
        const resource=definition.resource;
        const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
        if(!(maxValue>0)){ return {used:0,message:"角色目前沒有可恢復的資源上限。"}; }
        let used=0;
        let recoveredTotal=0;
        while(used<requested){
            const current=Math.max(0,Number(character[resource])||0);
            if(current>=maxValue){ break; }
            if(typeof consumePotionFromInventory!=="function"||!consumePotionFromInventory(definition.id,1)){ break; }
            const planned=definition.recoveryPercent>=100
                ?maxValue-current
                :Math.max(1,Math.round(maxValue*Number(definition.recoveryPercent||0)/100));
            const recovered=Math.max(0,Math.min(maxValue-current,planned));
            character[resource]=Math.min(maxValue,current+recovered);
            recoveredTotal+=recovered;
            used++;
            if(recovered<=0){ break; }
        }
        return {
            used,
            message:used>0
                ?(character.id||"角色")+"使用「"+definition.name+"」×"+used+"，共恢復 "+recoveredTotal+" "+String(resource).toUpperCase()+"。"
                :(character.id||"角色")+(resource==="hp"?" HP":" SP")+"目前不需要補充。"
        };
    }

    function getChestOpenOnce(item){
        if(!item){ return null; }
        if(item.id==="materialChest"&&typeof window.v132OpenMaterialChest==="function"){
            return function(){ return window.v132OpenMaterialChest(); };
        }
        if(item.id==="equipmentChest"&&typeof window.v17346OpenEquipmentChest==="function"){
            return function(){
                const rewards=window.v17346OpenEquipmentChest();
                return Array.isArray(rewards)
                    ?rewards.map(reward=>String((reward&&reward.name)||"裝備")+"×1")
                    :null;
            };
        }
        return null;
    }

    function batchChest(item,requested){
        const rewardMap=new Map();
        const notices=[];
        const originalAlert=window.alert;
        const openOnce=getChestOpenOnce(item);
        let used=0;
        if(!openOnce){ return {used:0,message:"這個寶箱目前沒有可用的開啟流程。"}; }
        window.alert=message=>{ notices.push(String(message||"")); };
        try{
            for(let index=0;index<requested;index++){
                const opened=openOnce();
                if(!opened){ break; }
                used++;
                opened.forEach(line=>parseRewardLine(line,rewardMap));
            }
        }finally{
            window.alert=originalAlert;
        }
        let message=used>0
            ?"已開啟「"+(item.name||"材料寶箱")+"」×"+used+"。\n獲得："+(formatRewardMap(rewardMap)||"獎勵已入背包")
            :"沒有成功開啟寶箱。";
        if(used<requested&&notices.length){ message+="\n\n"+notices[notices.length-1]; }
        return {used,message};
    }

    function batchTicket(item,requested){
        const rewardMap=new Map();
        const notices=[];
        const originalAlert=window.alert;
        let used=0;
        window.alert=message=>{ notices.push(String(message||"")); };
        try{
            for(let index=0;index<requested;index++){
                const before=ownedCountById(item.id);
                if(before<=0){ break; }
                const noticeStart=notices.length;
                window.useEquipmentTicket(item.id);
                const after=ownedCountById(item.id);
                if(after>=before){ break; }
                used++;
                const latest=notices.slice(noticeStart).join(" ");
                const match=latest.match(/獲得【([^】]+)】/);
                if(match){ rewardMap.set(match[1],(rewardMap.get(match[1])||0)+1); }
            }
        }finally{
            window.alert=originalAlert;
        }
        let message=used>0
            ?"已開啟「"+(item.name||"裝備券")+"」×"+used+"。\n獲得："+(formatRewardMap(rewardMap)||"裝備已放入背包")
            :"沒有成功開啟裝備券。";
        if(used<requested&&notices.length){
            const failure=notices[notices.length-1];
            if(!/獲得【/.test(failure)){ message+="\n\n"+failure; }
        }
        return {used,message};
    }

    window.v17350RunBatchAction=async function(){
        const panel=document.getElementById("v17350BatchAction");
        if(!panel){ return false; }
        const itemId=panel.dataset.itemId||"";
        const item=typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)
            ?inventoryItems.find(entry=>entry&&entry.id===itemId)
            :null;
        const descriptor=getBatchDescriptor(item);
        if(!item||!descriptor){ removeBatchActions(); return false; }
        const input=document.getElementById("v17350BatchQuantity");
        const requested=clampInteger(input&&input.value||descriptor.total,1,descriptor.total);
        if(input){ input.value=String(requested); }

        let result={used:0,message:"目前無法進行批量操作。"};
        if(descriptor.kind==="potion"){ result=batchPotion(item,requested); }
        else if(descriptor.kind==="chest"){ result=batchChest(item,requested); }
        else if(descriptor.kind==="ticket"){ result=batchTicket(item,requested); }

        if(result.used>0){
            if(typeof closeItemModal==="function"){ closeItemModal(); }
            refreshInventoryViews();
        }
        if(typeof window.rpgAlert==="function"){
            await window.rpgAlert(result.message,{
                title:descriptor.kind==="potion"?"批量使用完成":"批量開啟完成",
                confirmText:"知道了",
                tone:result.used>0?"success":"normal"
            });
        }
        return result.used>0;
    };

    function decorateOpenItemModal(slotIndex){
        const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;
        syncBatchActions(item);
    }

    if(typeof openItemModal==="function"){
        const previousOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=previousOpenItemModal.apply(this,arguments);
            decorateOpenItemModal(slotIndex);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(){
            const result=previousOpenEquippedItem.apply(this,arguments);
            removeBatchActions();
            return result;
        };
    }

    if(typeof closeItemModal==="function"){
        const previousCloseItemModal=closeItemModal;
        closeItemModal=function(){
            removeBatchActions();
            return previousCloseItemModal.apply(this,arguments);
        };
    }

    if(typeof renderInventoryItems==="function"){
        const previousRenderInventoryItems=renderInventoryItems;
        renderInventoryItems=function(){
            const result=previousRenderInventoryItems.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    if(typeof renderInventory==="function"){
        const previousRenderInventory=renderInventory;
        renderInventory=function(){
            const result=previousRenderInventory.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    if(typeof setInventoryFilter==="function"){
        const previousSetInventoryFilter=setInventoryFilter;
        setInventoryFilter=function(){
            const result=previousSetInventoryFilter.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    ensureBulkSellBar();

    /* QA compatibility owners follow this source inside gameplay-core. */

})();


/* bundled source: js/54-v173.51-battle-qa.js */
/* V173.51 — battle / targeting / EXP visibility / ad QA */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351BattleQaInstalled)return;
window.__v17351BattleQaInstalled=true;
let lastBlockedAt=0,adRunning=false;
const visible=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden";};
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(window.alert?.(m));
function inBattle(){try{return typeof battleActive!=="undefined"&&!!battleActive}catch(_){return false}}
function blocked(){const now=Date.now();if(now-lastBlockedAt<600)return;lastBlockedAt=now;void alertRpg("戰鬥進行中無法調整能力值，也無法學習或升級技能。\n請先結束戰鬥後再操作。",{title:"戰鬥中禁止養成操作",confirmText:"知道了",danger:true});}
function guard(name){const old=window[name];if(typeof old!=="function"||old.__v17351Guard)return;const fn=function(){if(inBattle()){blocked();return false}return old.apply(this,arguments)};fn.__v17351Guard=true;window[name]=fn;}
["addPoint","removePoint","confirmStatus","learnSkill","upgradeSkill"].forEach(guard);
document.addEventListener("click",e=>{if(!inBattle())return;const b=e.target?.closest?.("button,[role=button]");if(!b)return;const s=String(b.getAttribute?.("onclick")||"");if(!/(addPoint|removePoint|confirmStatus|learnSkill|upgradeSkill)\s*\(/.test(s))return;e.preventDefault();e.stopImmediatePropagation();blocked();},true);

function fivePriority(indexes){
    const list=(indexes||[]).filter(Number.isInteger);
    if(list.length!==5)return null;
    try{
        if(typeof window.v148GetAutoTargetPriority==="function"){
            return window.v148GetAutoTargetPriority(list).slice();
        }
    }catch(_){}
    return [list[3],list[1],list[4],list[2],list[0]].filter(Number.isInteger);
}
window.v17351FiveEnemyAutoTargetPriority=fivePriority;

/* V174 battle presentation owner.
   Slot geometry is owned exclusively by FourSymbolsBattlefieldSlots plus the
   formal render-geometry adapter. This layer owns only artwork decoration,
   layering and transient animation. It deliberately contains no Slot/Unit/HUD
   top/left/right/bottom/inset/width/height positioning rules. */
function removeRetiredPresentationStyles(){
    const style=document.getElementById("v174-cardless-battle-style");
    if(style){ style.remove(); }
}
function numericValue(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}
function setTextIfChanged(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function battleArtworkSource(card,kind){
    if(!card)return "";
    const computed=getComputedStyle(card);
    let source="";
    if(kind==="monster")source=String(computed.getPropertyValue("--v152-abyss-portrait")||"").trim();
    if(!source||source==="none")source=String(card.style.backgroundImage||"").trim();
    if(!source||source==="none")source=String(computed.backgroundImage||"").trim();
    if(source&&source!=="none"&&!/^linear-gradient/i.test(source))card.dataset.v174BattleArtwork=source;
    return card.dataset.v174BattleArtwork||"";
}
function syncUnitArtwork(card,kind){
    if(!card)return;
    card.classList.add("v174-cardless-unit");
    let art=card.querySelector(":scope > .v174-battle-art");
    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}
    const source=battleArtworkSource(card,kind);
    if(source)art.style.backgroundImage=source;
    card.style.setProperty("background-image","none","important");
}
function syncResourceNumbers(){
    document.querySelectorAll("#battlePage .battle-player[id^='battlePlayerCard']").forEach(card=>{
        const index=Number(String(card.id).replace("battlePlayerCard",""));
        let character=null;
        try{if(Number.isInteger(index)&&typeof getPartyCharacterByIndex==="function")character=getPartyCharacterByIndex(index);}catch(_){}
        if(!character)return;
        const hp=card.querySelector(".hp-bar-text"),sp=card.querySelector(".sp-bar-text");
        setTextIfChanged(hp,String(numericValue(character.hp)));
        setTextIfChanged(sp,String(numericValue(character.sp)));
    });
    document.querySelectorAll("#battlePage .battle-monster[id^='battleMonster']").forEach(card=>{
        const index=Number(String(card.id).replace("battleMonster",""));
        let monster=null;
        try{if(Number.isInteger(index)&&typeof monsters!=="undefined")monster=monsters[index];}catch(_){}
        if(!monster)return;
        const hp=card.querySelector(".monster-hp .monster-bar-text"),sp=card.querySelector(".monster-sp .monster-bar-text");
        setTextIfChanged(hp,String(numericValue(monster.hp)));
        setTextIfChanged(sp,String(numericValue(monster.sp)));
    });
}
function syncBattlePresentation(){
    removeRetiredPresentationStyles();
    document.querySelectorAll("#battlePage .battle-player").forEach(card=>syncUnitArtwork(card,"player"));
    document.querySelectorAll("#battlePage .battle-monster").forEach(card=>syncUnitArtwork(card,"monster"));
    syncResourceNumbers();
}
window.FourSymbolsBattlePresentation=Object.freeze({
    version:"cardless-presentation-v2",
    applyUnit:syncUnitArtwork,
    sync:syncBattlePresentation
});
function shakeArtForPopup(node){
    if(!(node instanceof Element))return;
    const popups=node.matches?.(".damage-popup.hp-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup.hp-popup")||[]);
    popups.forEach(popup=>{
        const owner=window.FourSymbolsBattlefieldSlots;
        const slot=popup.dataset?.slot||owner?.getSlotFromElement?.(popup)||null;
        const slotElement=slot&&owner?.getSlotElement?.(slot);
        const card=slotElement?.querySelector?.(".battle-player,.battle-monster")||popup.closest(".battle-player,.battle-monster");
        const art=card?.querySelector(":scope > .v174-battle-art");
        if(!art)return;
        art.classList.remove("v174-hit-shake");void art.offsetWidth;art.classList.add("v174-hit-shake");
        setTimeout(()=>art.classList.remove("v174-hit-shake"),300);
    });
}

/* V173.51: keep EXP row metadata stable after legacy list rerenders. */
function decorateExpRows(){
    if(typeof window.v173DecorateExpPoolDistributionUi==="function")window.v173DecorateExpPoolDistributionUi();
}
if(typeof renderExpDistributeList==="function"&&!renderExpDistributeList.__v17351ExpStable){
    const previousRenderExpDistributeList=renderExpDistributeList;
    const stableRender=function(){const result=previousRenderExpDistributeList.apply(this,arguments);decorateExpRows();return result;};
    stableRender.__v17351ExpStable=true;renderExpDistributeList=stableRender;window.renderExpDistributeList=stableRender;
}
function ensureExpRowsVisible(){
    const list=document.getElementById("expDistributeList");if(!list)return;
    const rows=Array.from(list.querySelectorAll(".v131-exp-row"));if(rows.length&&rows.some(row=>!row.querySelector(".v173-exp-row-meta")))decorateExpRows();
}
decorateExpRows();

function syncManagement(){
    /* VFX lifecycle belongs exclusively to the battle VFX owner. */
    document.body.classList.remove("v17351-management-open");
    document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice");});
    ensureExpRowsVisible();syncBattlePresentation();
}
window.v17351SyncManagement=syncManagement;

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';document.body.appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

const observer=new MutationObserver(mutations=>{
    let needsResourceSync=false;
    mutations.forEach(record=>record.addedNodes.forEach(node=>{
        shakeArtForPopup(node);
        if(!(node instanceof Element)){ return; }
        const units=node.matches?.(".battle-player,.battle-monster")
            ?[node]:Array.from(node.querySelectorAll?.(".battle-player,.battle-monster")||[]);
        units.forEach(card=>syncUnitArtwork(card,card.classList.contains("battle-monster")?"monster":"player"));
        if(units.length){ needsResourceSync=true; }
    }));
    if(needsResourceSync){ syncResourceNumbers(); }
});
observer.observe(document.body,{subtree:true,childList:true});
syncManagement();
})();


/* bundled source: js/55-v173.51-inventory-qa.js */
/* V173.51 — backpack compare / lock / custom sell picker / fullscreen */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351InventoryQaInstalled)return;
window.__v17351InventoryQaInstalled=true;
const TYPES=new Set(["head","shoulder","shoes","weapon","hand","armor"]),Q=["white","blue","purple","orange"],QL={white:"白裝",blue:"藍裝",purple:"紫裝",orange:"橙裝"},KEY=window.FourSymbolsAccountSave.accountKey("bulk-sell-quality");
const num=v=>Number.isFinite(Number(v))?Number(v):0,integer=(v,f=0)=>Math.max(0,Math.floor(Number.isFinite(Number(v))?Number(v):f));
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(),confirmRpg=(m,o)=>typeof window.rpgConfirm==="function"?window.rpgConfirm(m,o||{}):Promise.resolve(false);
function equipment(i){if(!i)return false;try{if(typeof isEquipmentInventoryType==="function")return !!isEquipmentInventoryType(i.type)}catch(_){}return TYPES.has(String(i.type||""));}
function quality(i){if(!i)return null;if(i.setId)return"orange";const d=String(i.rarityKey||i.quality||"").toLowerCase();if(Q.includes(d))return d;const t={low:"white",mid:"blue",high:"purple",perfect:"orange"}[String(i.tierKey||"").toLowerCase()];if(t)return t;return Q.find(k=>String(i.icon||"").includes("rarity-"+k))||null;}
function locked(i){return !!(i&&i.v17351Locked===true)}
function statText(i){const all=Object.assign({},i?.stats||{});Object.entries(i?.reforgeStats||{}).forEach(([k,v])=>all[k]=num(all[k])+num(v));const L={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",spirit:"精神",energy:"能量"};const a=Object.entries(all).filter(([,v])=>num(v)!==0).map(([k,v])=>(L[k]||k)+" "+(num(v)>0?"+":"")+num(v));return a.length?a.join("　"):"無額外能力";}
const SLOT_ALIAS={weapon:"hand",hand:"hand",head:"head",helmet:"head",shoulder:"shoulder",wristguard:"shoulder",armor:"armor",robe:"armor",shoes:"shoes",boots:"shoes"};
const SLOT_STORAGE_ALIASES={hand:["hand","weapon"],head:["head","helmet"],shoulder:["shoulder","wristguard"],armor:["armor","robe"],shoes:["shoes","boots"]};
const SLOT_LABEL={head:"頭部",hand:"武器",shoulder:"護腕",armor:"衣服",shoes:"鞋子"};
const COMPARE_STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",spirit:"精神",energy:"能量"};
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
function readQ(){let v="white";try{v=localStorage.getItem(KEY)||v}catch(_){}return Q.includes(v)?v:"white"}function writeQ(v){v=Q.includes(v)?v:"white";try{localStorage.setItem(KEY,v)}catch(_){}const s=document.getElementById("v17350BulkSellQuality");if(s)s.value=v;return v;}
function candidates(q){if(typeof inventoryItems==="undefined")return[];const max=Q.indexOf(q);return inventoryItems.filter(i=>equipment(i)&&!locked(i)&&Q.indexOf(quality(i))>=0&&Q.indexOf(quality(i))<=max)}
function summary(q){const c=candidates(q);let units=0,gold=0,orange=false;c.forEach(i=>{const n=Math.max(1,integer(i.count,1));units+=n;gold+=integer(i.price)*n;if(Q.indexOf(quality(i))>=3)orange=true});return{c,units,gold,orange}}
function picker(){const bar=document.getElementById("v17350BulkSellBar");if(!bar)return;const native=bar.querySelector("#v17350BulkSellQuality");if(native){native.hidden=true;native.tabIndex=-1;native.setAttribute("aria-hidden","true")}let p=document.getElementById("v17351BulkQualityPicker");if(!p){p=document.createElement("div");p.id="v17351BulkQualityPicker";p.className="v17351-quality-picker";p.innerHTML='<button id="v17351BulkQualityButton" type="button" aria-haspopup="listbox" aria-expanded="false" onclick="v17351ToggleQualityMenu()"></button><div class="v17351-quality-menu" role="listbox">'+Q.map(k=>'<button type="button" role="option" data-q="'+k+'" onclick="v17351ChooseQuality(\''+k+'\')"><i class="'+k+'"></i>'+QL[k]+'以下</button>').join("")+'</div>';native?native.insertAdjacentElement("afterend",p):bar.prepend(p)}syncSellUi();}
window.v17351ToggleQualityMenu=()=>{const p=document.getElementById("v17351BulkQualityPicker"),b=document.getElementById("v17351BulkQualityButton");if(!p||!b)return;const open=!p.classList.contains("open");p.classList.toggle("open",open);b.setAttribute("aria-expanded",open?"true":"false")};
window.v17351ChooseQuality=v=>{writeQ(v);document.getElementById("v17351BulkQualityPicker")?.classList.remove("open");syncSellUi()};
function syncSellUi(){const bar=document.getElementById("v17350BulkSellBar");if(!bar)return;const q=readQ(),s=summary(q),b=document.getElementById("v17351BulkQualityButton"),sell=bar.querySelector("#v17350BulkSellButton"),meta=bar.querySelector("#v17350BulkSellMeta");if(b){const text=QL[q]+"以下 ▾";if(b.textContent!==text)b.textContent=text;}document.querySelectorAll("#v17351BulkQualityPicker [data-q]").forEach(o=>{const yes=o.dataset.q===q;if(o.classList.contains("selected")!==yes)o.classList.toggle("selected",yes);const aria=yes?"true":"false";if(o.getAttribute("aria-selected")!==aria)o.setAttribute("aria-selected",aria)});if(sell){if(sell.disabled!==(s.units<=0))sell.disabled=s.units<=0;const text="售出 "+s.units+" 件";if(sell.textContent!==text)sell.textContent=text;if(sell.classList.contains("danger")!==s.orange)sell.classList.toggle("danger",s.orange)}if(meta){const lc=typeof inventoryItems!=="undefined"?inventoryItems.filter(i=>equipment(i)&&locked(i)).length:0;const text=s.units?"預計獲得 "+s.gold.toLocaleString("zh-TW")+" 金幣"+(lc?"・略過 "+lc+" 件鎖定":""):"目前沒有符合條件且未鎖定的裝備";if(meta.textContent!==text)meta.textContent=text}}
window.v17350BulkSellEquipment=async function(){const q=readQ(),s=summary(q);if(!s.units){await alertRpg("目前沒有符合「"+QL[q]+"以下」且未鎖定的背包裝備。",{title:"一鍵售出",confirmText:"知道了"});return false}const ok=await confirmRpg((s.orange?"⚠ 本次包含橙裝。\n":"")+"將售出 "+s.units+" 件未鎖定裝備，獲得 "+s.gold.toLocaleString("zh-TW")+" 金幣。\n"+(s.orange?"橙裝售出後無法復原，確定繼續嗎？":"確定售出嗎？"),{title:s.orange?"高品質裝備警告":"一鍵售出確認",confirmText:"確認售出",cancelText:"取消",danger:s.orange});if(!ok)return false;const set=new Set(s.c);for(let i=inventoryItems.length-1;i>=0;i--)if(set.has(inventoryItems[i]))inventoryItems.splice(i,1);if(typeof gold!=="undefined")gold+=s.gold;if(typeof selectedInventorySlot!=="undefined")selectedInventorySlot=null;if(typeof closeItemModal==="function")closeItemModal();saveRefresh();picker();await alertRpg("已售出 "+s.units+" 件裝備。\n獲得 "+s.gold.toLocaleString("zh-TW")+" 金幣。",{title:"一鍵售出完成",confirmText:"知道了",tone:"success"});return true};
document.addEventListener("click",e=>{const p=document.getElementById("v17351BulkQualityPicker");if(p&&p.classList.contains("open")&&!p.contains(e.target))p.classList.remove("open")});
function visible(el){if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden"}
function fullscreen(){const inv=document.getElementById("inventoryPage"),shell=document.getElementById("characterPage")||document.getElementById("characterModal"),shellOpen=!shell||visible(shell),open=!!(inv&&visible(inv)&&(inv.classList.contains("map-inventory-overlay-open")||shellOpen));if(document.body.classList.contains("v17351-inventory-fullscreen")!==open)document.body.classList.toggle("v17351-inventory-fullscreen",open);if(open)picker();}
let inventorySyncQueued=false;function scheduleInventorySync(){if(inventorySyncQueued)return;inventorySyncQueued=true;const run=()=>{inventorySyncQueued=false;fullscreen();picker();syncSellUi()};if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else setTimeout(run,0)}const obs=new MutationObserver(scheduleInventorySync);obs.observe(document.body,{subtree:true,childList:true});setInterval(scheduleInventorySync,500);scheduleInventorySync();
})();


/* bundled source: js/56-v173.51-shop-qa.js */
/* V173.51 — equipment shop purchase state / unlimited free refresh / image repair */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351ShopQaInstalled)return;
window.__v17351ShopQaInstalled=true;
const STATE=window.FourSymbolsAccountSave.accountKey("equipment-shop-daily"),BOUGHT=window.FourSymbolsAccountSave.accountKey("equipment-shop-purchases"),SIZE=6;
const safe=v=>Math.max(0,Math.floor(Number(v)||0)),alertRpg=(m,o)=>typeof rpgAlert==="function"?rpgAlert(m,o||{}):Promise.resolve(),confirmRpg=(m,o)=>typeof rpgConfirm==="function"?rpgConfirm(m,o||{}):Promise.resolve(false);
function day(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function loadState(){const date=day();let x={date,refreshCount:0};try{const r=JSON.parse(localStorage.getItem(STATE)||"{}");if(r.date===date)x.refreshCount=safe(r.refreshCount)}catch(_){}return x}function saveState(x){try{localStorage.setItem(STATE,JSON.stringify(x))}catch(_){}}
function loadBought(){const date=day();let x={date,cycles:{}};try{const r=JSON.parse(localStorage.getItem(BOUGHT)||"{}");if(r.date===date&&r.cycles)x={date,cycles:r.cycles}}catch(_){}return x}function bought(count){const x=loadBought(),a=x.cycles["r"+safe(count)];return new Set(Array.isArray(a)?a.map(Number):[])}function mark(count,i){const x=loadBought(),k="r"+safe(count),s=new Set(Array.isArray(x.cycles[k])?x.cycles[k].map(Number):[]);s.add(Number(i));x.cycles[k]=[...s].sort((a,b)=>a-b);try{localStorage.setItem(BOUGHT,JSON.stringify(x))}catch(_){} }
function hash(v){let h=2166136261;for(const c of String(v)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}function rng(seed){let s=hash(seed)||1;return()=>{s=(s+0x6D2B79F5)|0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function offers(){const st=loadState();if(typeof window.v17346GenerateEquipment!=="function")return[];return Array.from({length:SIZE},(_,i)=>window.v17346GenerateEquipment(rng(st.date+":"+st.refreshCount+":"+i)))}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function q(i){if(i?.setId)return"orange";const x=String(i?.rarityKey||i?.quality||"");return["white","blue","purple","orange"].includes(x)?x:"white"}function slot(i){return({head:"頭盔",shoulder:"護腕",shoes:"鞋子",weapon:"武器",armor:"衣服",hand:"護腕"})[i?.type]||"裝備"}function stats(i){const L={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",spirit:"精神",energy:"能量"};const a=Object.entries(i?.stats||{}).filter(([,v])=>Number(v)).map(([k,v])=>(L[k]||k)+" "+(v>0?"+":"")+v);return a.join("　")||"無額外能力"}
window.v17351RetryShopImage=function(img){if(!img)return;const src=String(img.dataset.src||"");if(img.dataset.retry!=="1"&&src){img.dataset.retry="1";img.hidden=false;img.src=src+(src.includes("?")?"&":"?")+"v=173.58-"+Date.now();return}img.hidden=true;img.parentElement?.classList.add("image-failed")};
function image(i,index){const src=String(i?.assetPath||""),rarity=q(i),fallback=slot(i).slice(0,1);if(!src)return'<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+' v17351-shop-image image-failed"><span class="v17351-shop-fallback">'+fallback+'</span></span>';return'<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+' v17351-shop-image"><img src="'+esc(src)+'?v=173.58" data-src="'+esc(src)+'" data-i="'+index+'" alt="" draggable="false" decoding="async" loading="eager" onerror="v17351RetryShopImage(this)"><span class="v17351-shop-fallback">'+fallback+'</span></span>'}
window.v17351PreviewEquipmentShopOffer=function(index){const i=Math.max(0,Math.min(SIZE-1,safe(index))),item=offers()[i];if(!item||typeof window.v132ShowRewardModal!=="function")return;const price=safe(item.shopPrice||item.price),html='<div class="v132-reward-modal-inner v17346-shop-preview-modal" data-rarity="'+esc(q(item))+'"><h3>'+esc(item.name||"裝備")+'</h3><div class="v17346-shop-preview-art">'+image(item,i)+'</div><div class="v17346-shop-preview-info"><span>'+slot(item)+'</span><strong>'+stats(item)+'</strong></div><div class="v17346-shop-preview-price">'+price.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';window.v132ShowRewardModal(html)};
window.v17346PreviewEquipmentShopOffer=window.v17351PreviewEquipmentShopOffer;
function render(force){const root=document.querySelector("#homeFeatureModalBody .v17345-equipment-shop");if(!root)return false;const st=loadState(),all=offers();if(!all.length)return false;const bs=bought(st.refreshCount),sig=st.date+"|"+st.refreshCount+"|"+[...bs].join(","),broken=root.textContent.includes("售價待設定")||root.querySelectorAll(".v17345-equipment-icon img").length===0;if(!force&&root.dataset.v17351===sig&&!broken)return true;root.dataset.v17351=sig;const currentGold=safe(typeof gold!=="undefined"?gold:0);root.innerHTML='<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+currentGold.toLocaleString("zh-TW")+'</b></div><div class="v17345-equipment-grid">'+all.map((i,n)=>{const done=bs.has(n),price=safe(i.shopPrice||i.price),canBuy=!done&&currentGold>=price,stateClass=done?"purchased is-affordable":(canBuy?"is-affordable":"is-unaffordable");return'<article class="v17345-equipment-card v17346-shop-card '+stateClass+'" data-rarity="'+esc(q(i))+'" role="button" tabindex="0" aria-label="預覽 '+esc(i.name||"裝備")+'" onclick="v17351PreviewEquipmentShopOffer('+n+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();v17351PreviewEquipmentShopOffer('+n+')}"><div class="v17345-equipment-icon v17346-gear-art">'+image(i,n)+'</div><b class="v17346-shop-name">'+esc(i.name||"裝備")+'</b><span class="v17346-shop-slot">'+slot(i)+'</span><span class="v17346-stat">'+stats(i)+'</span>'+(i.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy '+(done?"v17351-purchased-buy":"")+'" type="button" '+(done?'disabled aria-disabled="true"':canBuy?'onclick="event.stopPropagation();v17351BuyEquipmentShopOffer('+n+')"':'disabled aria-disabled="true"')+'>'+(done?"✓ 已購買":price.toLocaleString("zh-TW")+" 金幣")+'</button></article>'}).join("")+'</div><div class="v17345-equipment-refresh v17351-free-refresh"><div><b>測試模式・無限免費刷新</b><span>目前第 '+st.refreshCount+' 次刷新；測試期間不扣金幣、不設上限。</span></div><button type="button" onclick="v17351RefreshEquipmentShop()">免費刷新</button></div>';return true}
window.v17351RenderEquipmentShop=()=>render(true);
window.v17351RefreshEquipmentShop=function(){const s=loadState();s.refreshCount=safe(s.refreshCount)+1;saveState(s);render(true)};window.v17345RefreshEquipmentShop=window.v17351RefreshEquipmentShop;
window.v17351BuyEquipmentShopOffer=async function(index){const st=loadState(),i=safe(index);if(bought(st.refreshCount).has(i)){await alertRpg("這件裝備本輪已購買，刷新後才會出現新的購買機會。",{title:"已購買",confirmText:"知道了"});render(true);return false}const item=offers()[i];if(!item)return false;const price=safe(item.shopPrice||item.price);if(typeof gold==="undefined"||Number(gold)<price){await alertRpg("金幣不足。\n需要 "+price.toLocaleString("zh-TW")+" 金幣。",{title:"購買失敗",confirmText:"知道了",danger:true});return false}if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)||inventoryItems.length>=120){await alertRpg("背包已滿，請先整理背包。",{title:"購買失敗",confirmText:"知道了",danger:true});return false}const ok=await confirmRpg("購買「"+(item.name||"裝備")+"」？\n"+stats(item)+"\n價格："+price.toLocaleString("zh-TW")+" 金幣",{title:"購買裝備",confirmText:"購買",cancelText:"取消"});if(!ok||bought(st.refreshCount).has(i))return false;gold-=price;inventoryItems.push(item);mark(st.refreshCount,i);if(typeof updateGoldDisplay==="function")updateGoldDisplay();if(typeof rebuildInventorySlots==="function")rebuildInventorySlots();if(typeof updateUI==="function")updateUI();if(typeof saveGame==="function")saveGame();render(true);await alertRpg("已購買「"+(item.name||"裝備")+"」。\n已放入背包。",{title:"購買完成",confirmText:"知道了",tone:"success"});return true};window.v17346BuyEquipmentShopOffer=window.v17351BuyEquipmentShopOffer;
if(typeof window.v169SwitchShopPage==="function"){const old=window.v169SwitchShopPage;window.v169SwitchShopPage=function(page){const r=old.apply(this,arguments);if(page==="equipment"){setTimeout(()=>render(true),0);setTimeout(()=>render(false),150)}return r}}
if(typeof window.openHomeFeature==="function"){const old=window.openHomeFeature;window.openHomeFeature=function(type){const r=old.apply(this,arguments);if(type==="shop"){setTimeout(()=>render(false),0);setTimeout(()=>render(false),200)}return r}}
const obs=new MutationObserver(()=>render(false));obs.observe(document.body,{subtree:true,childList:true});setInterval(()=>render(false),800);
})();


/* bundled source: js/57-v173.51-quest-qa.js */
/* V173.51 — achievements / daily + commission quest QA */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351QuestQaInstalled)return;
window.__v17351QuestQaInstalled=true;
const PAGE=5;let page=0;
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(),n=v=>Number.isFinite(Number(v))?Number(v):0;
function achievements(){try{return Array.isArray(achievementDefinitions)?achievementDefinitions:[]}catch(_){return[]}}function ready(a){try{return !!(a&&typeof a.check==="function"&&a.check())}catch(_){return false}}function claimed(a){try{return !!(a&&achievementState[a.id])}catch(_){return false}}
function rewardLabel(r){if(!r)return"無";const L={gold:"金幣",exp:"EXP",sharedExp:"EXP"};return Object.entries(r).map(([k,v])=>(L[k]||k)+" +"+Math.floor(n(v))).join("・")||"無"}
const originalClaim=typeof window.claimAchievement==="function"?window.claimAchievement:null;
function render(){const list=achievements(),pages=Math.max(1,Math.ceil(list.length/PAGE));page=Math.max(0,Math.min(pages-1,page));const slice=list.slice(page*PAGE,(page+1)*PAGE),can=list.filter(a=>ready(a)&&!claimed(a)).length;return'<section class="v17351-achievement-shell"><div class="v17351-achievement-toolbar"><span>共 '+list.length+' 項成就</span><button type="button" class="v17351-achievement-claim-all" '+(can?"":"disabled")+' onclick="v17351ClaimAllAchievements()">一鍵領取'+(can?"（"+can+"）":"")+'</button></div><div class="v17351-achievement-list">'+slice.map(a=>{const r=ready(a),c=claimed(a);return'<article class="v17351-achievement-card '+(c?"claimed":r?"ready":"locked")+'"><div class="v17351-achievement-copy"><b>'+String(a.name||"成就")+'</b><span>'+String(a.desc||"")+'</span><small>獎勵：'+rewardLabel(a.reward)+'</small></div><button type="button" '+(!r||c?"disabled":"")+' onclick="v17351ClaimAchievement(\''+String(a.id||"")+'\')">'+(c?"✓ 已領取":r?"領取":"未達成")+'</button></article>'}).join("")+'</div><div class="v17351-achievement-pager"><button type="button" onclick="v17351ChangeAchievementPage(-1)">←</button><b>'+(page+1)+' / '+pages+'</b><button type="button" onclick="v17351ChangeAchievementPage(1)">→</button></div></section>'}
window.renderAchievementContent=render;
function refreshAchievements(){const body=document.getElementById("homeFeatureModalBody"),title=String(document.getElementById("homeFeatureModalTitle")?.textContent||"");if(body&&(/成就/.test(title)||document.querySelector(".v17351-achievement-shell")))body.innerHTML=render()}
window.v17351ChangeAchievementPage=d=>{page+=Number(d)||0;refreshAchievements()};
window.v17351ClaimAchievement=async id=>{const a=achievements().find(x=>x?.id===id);if(!a||claimed(a)||!ready(a))return false;const before=claimed(a),g0=typeof gold!=="undefined"?n(gold):0,e0=typeof sharedExp!=="undefined"?n(sharedExp):0;if(originalClaim)originalClaim(id);else{achievementState[id]=true;if(a.reward?.gold&&typeof gold!=="undefined")gold+=n(a.reward.gold)}if(before===claimed(a))return false;refreshAchievements();const gd=Math.max(0,(typeof gold!=="undefined"?n(gold):g0)-g0),ed=Math.max(0,(typeof sharedExp!=="undefined"?n(sharedExp):e0)-e0);await alertRpg("已領取「"+(a.name||"成就")+"」獎勵。"+(gd?"\n金幣 +"+Math.floor(gd).toLocaleString("zh-TW"):"")+(ed?"\nEXP +"+Math.floor(ed).toLocaleString("zh-TW"):""),{title:"成就獎勵",confirmText:"知道了",tone:"success"});return true};
window.v17351ClaimAllAchievements=async()=>{const list=achievements().filter(a=>ready(a)&&!claimed(a));if(!list.length)return false;const g0=typeof gold!=="undefined"?n(gold):0,e0=typeof sharedExp!=="undefined"?n(sharedExp):0;let count=0;list.forEach(a=>{if(originalClaim)originalClaim(a.id);else{achievementState[a.id]=true;if(a.reward?.gold&&typeof gold!=="undefined")gold+=n(a.reward.gold)}if(claimed(a))count++});refreshAchievements();const gd=Math.max(0,(typeof gold!=="undefined"?n(gold):g0)-g0),ed=Math.max(0,(typeof sharedExp!=="undefined"?n(sharedExp):e0)-e0);await alertRpg("已一次領取 "+count+" 項成就獎勵。"+(gd?"\n金幣 +"+Math.floor(gd).toLocaleString("zh-TW"):"")+(ed?"\nEXP +"+Math.floor(ed).toLocaleString("zh-TW"):""),{title:"一鍵領取完成",confirmText:"知道了",tone:"success"});return true};

function rewardText(r){return[r?.gold?"金幣 +"+Math.floor(n(r.gold)).toLocaleString("zh-TW"):null,r?.exp?"EXP +"+Math.floor(n(r.exp)).toLocaleString("zh-TW"):null].filter(Boolean).join("\n")||"獎勵已領取"}
if(typeof window.claimDailyQuest==="function"){const old=window.claimDailyQuest;window.claimDailyQuest=function(id){const q=typeof dailyQuestDefinitions!=="undefined"?dailyQuestDefinitions.find(x=>x.id===id):null,b=typeof dailyQuestState!=="undefined"&&!!dailyQuestState.claimed[id],r=old.apply(this,arguments),a=typeof dailyQuestState!=="undefined"&&!!dailyQuestState.claimed[id];if(!window.__v17361BulkQuestClaim&&!b&&a&&q)void alertRpg("已領取「"+(q.name||"每日任務")+"」。\n"+rewardText(q.reward),{title:"每日任務獎勵",confirmText:"知道了",tone:"success"});setTimeout(previewChests,0);return r}}
if(typeof window.claimCommissionQuest==="function"){const old=window.claimCommissionQuest;window.claimCommissionQuest=function(id){const q=typeof commissionQuestDefinitions!=="undefined"?commissionQuestDefinitions.find(x=>x.id===id):null,b=typeof commissionQuestState!=="undefined"&&!!commissionQuestState.claimed[id],r=old.apply(this,arguments),a=typeof commissionQuestState!=="undefined"&&!!commissionQuestState.claimed[id];if(!window.__v17361BulkQuestClaim&&!b&&a&&q)void alertRpg("已領取「"+(q.name||"委託任務")+"」。\n"+rewardText(q.reward),{title:"委託任務獎勵",confirmText:"知道了",tone:"success"});setTimeout(previewChests,0);return r}}
if(typeof window.v141ClaimQuestMilestone==="function"){const old=window.v141ClaimQuestMilestone;window.v141ClaimQuestMilestone=function(type,threshold){const g0=typeof gold!=="undefined"?n(gold):0,e0=typeof sharedExp!=="undefined"?n(sharedExp):0,r=old.apply(this,arguments),gd=Math.max(0,(typeof gold!=="undefined"?n(gold):g0)-g0),ed=Math.max(0,(typeof sharedExp!=="undefined"?n(sharedExp):e0)-e0);if(gd||ed)void alertRpg("完成度 "+threshold+"% 寶箱已領取。"+(gd?"\n金幣 +"+Math.floor(gd).toLocaleString("zh-TW"):"")+(ed?"\nEXP +"+Math.floor(ed).toLocaleString("zh-TW"):""),{title:type==="commission"?"委託完成度獎勵":"每日完成度獎勵",confirmText:"知道了",tone:"success"});setTimeout(previewChests,0);return r}}
window.v17351PreviewQuestMilestone=(type,threshold,label)=>void alertRpg("完成度達到 "+threshold+"% 後可領取：\n"+(label||"獎勵"),{title:type==="commission"?"委託寶箱預覽":"每日寶箱預覽",confirmText:"知道了"});
function previewChests(){const modal=document.getElementById("homeFeatureModal");if(!modal)return;const type=/委託/.test(String(document.getElementById("homeFeatureModalTitle")?.textContent||""))?"commission":"daily";modal.querySelectorAll(".quest-milestone:not(.reached) .quest-milestone-slot").forEach(b=>{const t=parseInt(b.closest(".quest-milestone")?.querySelector(".quest-milestone-percent")?.textContent||"0",10)||0,label=String(b.querySelector("small")?.textContent||b.getAttribute("aria-label")||"獎勵");b.disabled=false;b.classList.add("v17351-previewable");b.setAttribute("aria-label","預覽 "+t+"% 獎勵");b.onclick=e=>{e.preventDefault();window.v17351PreviewQuestMilestone(type,t,label)}})}
if(typeof window.openHomeFeature==="function"){const old=window.openHomeFeature;window.openHomeFeature=function(type){const r=old.apply(this,arguments);if(type==="achievement")setTimeout(refreshAchievements,0);if(type==="daily"||type==="quest")setTimeout(previewChests,0);return r}}
const obs=new MutationObserver(previewChests);obs.observe(document.body,{subtree:true,childList:true});setInterval(previewChests,700);window.__v17351QaReady=true;
})();


/* bundled source: js/58-v173.63-functional-fixes.js */
/* =====================================================
   V173.63 — requested functional fixes (runtime authority)
   - maximum character, synthesis and dungeon-backpack canvases
   - canonical item art + formal rarity frames
   - premium text-only daily dungeon reward previews
   - material promotion synthesis through Four-Symbol tier
===================================================== */
(function installV17363FunctionalFixes(){
"use strict";
if(typeof window==="undefined"||typeof document==="undefined"||window.__v17363FunctionalFixesInstalled){return;}
window.__v17363FunctionalFixesInstalled=true;

const TIER_ORDER=["white","blue","purple","orange","pink","four-symbol"];
const TIER_LABEL={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};
const TIER_ALIAS={low:"white",mid:"blue",high:"purple",perfect:"orange"};
const BLUEPRINT_SLOTS=["head","shoulder","armor","shoes","hand"];
const SLOT_LABEL={head:"頭部",shoulder:"護腕",armor:"衣服",shoes:"腳",hand:"武器"};
const MATERIAL_STATE={oreTier:"white",blueprintTier:"white",blueprintSet:"setFire",blueprintSlot:"head"};
let materialTabActive=false;
let repairQueued=false;

function normalizeTier(value){
    const key=String(value||"").toLowerCase();
    return TIER_ALIAS[key]||key;
}
function esc(value){
    return String(value==null?"":value)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function defs(){
    const content=typeof window.v132GetContentDefinitions==="function"?(window.v132GetContentDefinitions()||{}):{};
    return {
        ores:Array.isArray(content.ores)?content.ores:[],
        blueprints:Array.isArray(content.blueprints)?content.blueprints:[],
        talismans:Array.isArray(content.talismans)?content.talismans:[],
        tickets:Array.isArray(content.tickets)?content.tickets:[],
        equipmentSetItems:Array.isArray(content.equipmentSetItems)?content.equipmentSetItems:[]
    };
}
function ownedCount(id){
    if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){return 0;}
    return inventoryItems.reduce((sum,item)=>sum+(item&&item.id===id?Math.max(1,Math.floor(Number(item.count)||1)):0),0);
}
function setImp(node,key,value){if(node&&node.style){node.style.setProperty(key,value,"important");}}
function refreshInventory(){
    if(typeof window.v17361SyncItemArt==="function"){try{window.v17361SyncItemArt();}catch(_){}}
    if(typeof rebuildInventorySlots==="function"){try{rebuildInventorySlots();}catch(_){}}
    if(typeof renderInventoryItems==="function"){try{renderInventoryItems();}catch(_){}}
    else if(typeof renderInventory==="function"){try{renderInventory();}catch(_){}}
    if(typeof updateGoldDisplay==="function"){try{updateGoldDisplay();}catch(_){}}
    if(typeof saveGame==="function"){try{saveGame();}catch(_){}}
}

/* ---------- 2 / 6 / 7. Use the maximum game canvas. ---------- */
function maximizeCharacterPanel(){
    const modal=document.getElementById("homeFeatureModal");
    if(!modal||!modal.classList.contains("show")){return;}
    const box=modal.querySelector(".home-feature-modal-box.wide");
    const body=document.getElementById("homeFeatureModalBody");
    const root=document.getElementById("characterTabContent");
    if(!box||!root){return;}
    setImp(modal,"padding","4px");
    setImp(box,"width","calc(100% - 8px)");
    setImp(box,"max-width","none");
    setImp(box,"height","calc(100% - 8px)");
    setImp(box,"max-height","calc(100% - 8px)");
    setImp(box,"min-height","0");
    setImp(box,"display","flex");
    setImp(box,"flex-direction","column");
    setImp(box,"overflow","hidden");
    setImp(body,"flex","1 1 auto");
    setImp(body,"min-height","0");
    setImp(body,"overflow","hidden");
    setImp(root,"flex","1 1 auto");
    setImp(root,"min-height","0");
    setImp(root,"max-height","none");
    setImp(root,"overflow-x","hidden");
    setImp(root,"overflow-y","auto");
    setImp(root,"touch-action","pan-y");
}
function maximizeSynthesisPanel(){
    const modal=document.getElementById("homeFeatureModal");
    if(!modal||!modal.classList.contains("v141-synthesis-modal")){return;}
    const box=modal.querySelector(".home-feature-modal-box");
    const body=document.getElementById("homeFeatureModalBody");
    setImp(modal,"padding","4px");
    setImp(box,"width","calc(100% - 8px)");
    setImp(box,"max-width","none");
    setImp(box,"height","calc(100% - 8px)");
    setImp(box,"max-height","calc(100% - 8px)");
    setImp(box,"min-height","0");
    setImp(box,"display","flex");
    setImp(box,"flex-direction","column");
    setImp(box,"overflow","hidden");
    setImp(body,"flex","1 1 auto");
    setImp(body,"min-height","0");
    setImp(body,"overflow","hidden");
    setImp(body,"touch-action","pan-y");
    const synthesisBody=body&&body.querySelector(".v141-synthesis-body");
    setImp(synthesisBody,"flex","1 1 auto");
    setImp(synthesisBody,"min-height","0");
    setImp(synthesisBody,"overflow-x","hidden");
    setImp(synthesisBody,"overflow-y","auto");
    setImp(synthesisBody,"overscroll-behavior-y","contain");
    setImp(synthesisBody,"touch-action","pan-y");
}
function maximizeDungeonBackpack(){
    const app=document.getElementById("app");
    const page=document.getElementById("inventoryPage");
    if(!app||!page||!app.classList.contains("v141-dungeon-active")||!page.classList.contains("map-inventory-overlay-open")){return;}
    page.classList.add("v169-dungeon-inventory-overlay");
    [["inset","0"],["left","0"],["right","0"],["top","0"],["bottom","0"],["width","100%"],["max-width","none"],["height","100%"],["max-height","none"],["transform","none"],["padding","8px"],["box-sizing","border-box"]].forEach(([k,v])=>setImp(page,k,v));
    const shell=page.querySelector(".inventory-classic-shell");
    setImp(shell,"width","100%");setImp(shell,"max-width","none");setImp(shell,"min-height","100%");setImp(shell,"margin","0");
}

/* ---------- 3 / 7. Canonical item icons and explicit rarity frames. ---------- */
function canonicalDefinition(id){
    const content=defs();
    for(const group of [content.ores,content.blueprints,content.talismans,content.tickets,content.equipmentSetItems]){
        const found=group.find(item=>item&&item.id===id);
        if(found){return found;}
    }
    return null;
}
function syncCanonicalItemArt(){
    if(typeof window.v17361SyncItemArt==="function"){try{window.v17361SyncItemArt();}catch(_){}}
    if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){return;}
    inventoryItems.forEach(item=>{
        if(!item||!item.id){return;}
        const definition=canonicalDefinition(item.id);
        if(definition&&definition.icon){
            item.icon=definition.icon;
            if(definition.tierKey){item.tierKey=normalizeTier(definition.tierKey);}
        }
    });
}
function equipmentArt(item){
    if(!item){return "";}
    if(item.assetPath){
        const rarity=esc(normalizeTier(item.rarityKey||item.quality||item.tierKey||"white"));
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+'"><img src="'+esc(item.assetPath)+'" alt="" draggable="false" onerror="this.hidden=true"></span>';
    }
    return String(item.icon||"");
}
function findOwned(value){
    const key=String(value||"");
    const bag=typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)?inventoryItems:[];
    let found=bag.find(item=>item&&(String(item.id||"")===key||String(item.v141Uid||"")===key));
    if(found){return found;}
    if(typeof characterEquipment!=="undefined"&&characterEquipment){
        for(const slots of Object.values(characterEquipment||{})){
            found=Object.values(slots||{}).find(item=>item&&(String(item.id||"")===key||String(item.v141Uid||"")===key));
            if(found){return found;}
        }
    }
    return null;
}
function pickerArt(value){
    const owned=findOwned(value);
    const definition=canonicalDefinition(owned&&owned.id||value);
    if(definition&&definition.icon){return String(definition.icon);}
    return equipmentArt(owned);
}
function repairPicker(picker){
    const label=picker&&picker.closest("label");
    const select=label&&label.querySelector("select");
    if(!select){return;}
    const options=Array.from(select.options||[]);
    Array.from(picker.querySelectorAll("button")).forEach((button,index)=>{
        const option=options[index];if(!option){return;}
        const host=button.querySelector("i");
        const art=pickerArt(option.value);
        if(host&&art&&host.innerHTML!==art){host.innerHTML=art;}
        button.classList.toggle("selected",String(option.value)===String(select.value));
    });
}
function repairSynthesisIcons(){document.querySelectorAll(".v143-item-picker").forEach(repairPicker);}

/* ---------- 5. Actual text-only premium reward previews (no pseudo-image preview). ---------- */
function previewMarkup(title,eyebrow,groups,note){
    return '<div class="v132-reward-modal-inner v17361-reward-preview v17363-text-reward-preview">'+
        '<div class="v17363-preview-heading"><small>'+esc(eyebrow||"REWARD PREVIEW")+'</small><h3>'+esc(title)+'</h3></div>'+
        '<div class="v17363-preview-groups">'+groups.map(group=>
            '<section class="v17363-preview-group"><b>'+esc(group.title)+'</b>'+
            (group.badge?'<em>'+esc(group.badge)+'</em>':'')+
            '<p>'+esc(group.text)+'</p></section>'
        ).join("")+'</div>'+
        (note?'<div class="v17363-preview-note">'+esc(note)+'</div>':'')+
        '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
}
window.v148ShowDailyDungeonPreview=function(type){
    if(typeof window.v132ShowRewardModal!=="function"){return;}
    const table={
        exp:{title:"經驗副本獎勵預覽",groups:[
            {title:"共用經驗池",badge:"EXP",text:"通關所得經驗直接存入共用經驗池，不綁定單一角色，可自由分配給隊伍角色。"},
            {title:"結算方式",text:"完成副本後直接結算；若該結算提供廣告加倍，可自行選擇是否加倍領取。"}
        ],note:"重點養成資源一眼看懂，不再用獎勵圖片佔據版面。"},
        material:{title:"材料副本獎勵預覽",groups:[
            {title:"材料寶箱",badge:"×1～3",text:"通關回合越少，取得寶箱數越高；寶箱內含礦石、裝備設計圖等養成材料。"},
            {title:"用途",text:"礦石與同部位設計圖可用於裝備製作、冶煉，以及材料升階合成。"}
        ],note:"寶箱數量依副本結算規則決定。"},
        gold:{title:"金幣副本獎勵預覽",groups:[
            {title:"金幣獎勵",badge:"GOLD",text:"依目前副本難度與結算規則獲得金幣，通關後直接入帳。"},
            {title:"加倍選項",text:"若結算提供廣告加倍，可選擇觀看廣告取得加倍金幣，不影響直接領取。"}
        ],note:"僅顯示實際會影響玩家決策的資訊。"}
    };
    const meta=table[type]||table.exp;
    window.v132ShowRewardModal(previewMarkup(meta.title,"DAILY DUNGEON",meta.groups,meta.note));
};

/* ---------- 8. Equipment dungeon art path authority. ---------- */
function ensureFunctionalStyles(){
    if(document.getElementById("v17363-functional-fixes-style")){return;}
    const style=document.createElement("style");
    style.id="v17363-functional-fixes-style";
    style.textContent=`
#game-stage .v169-material-art{box-sizing:border-box!important;border:2px solid currentColor!important;border-radius:8px!important;padding:2px!important;background:#090b0f!important;}
#game-stage .v169-material-art.v169-rarity-white,#game-stage .v169-material-art.v169-rarity-low{color:#D8D8D8!important;border-color:#D8D8D8!important;box-shadow:0 0 7px rgba(216,216,216,.78),inset 0 0 7px rgba(216,216,216,.24)!important;}
#game-stage .v169-material-art.v169-rarity-blue,#game-stage .v169-material-art.v169-rarity-mid{color:#42A5FF!important;border-color:#42A5FF!important;box-shadow:0 0 8px rgba(66,165,255,.88),inset 0 0 7px rgba(66,165,255,.32)!important;}
#game-stage .v169-material-art.v169-rarity-purple,#game-stage .v169-material-art.v169-rarity-high{color:#B05CFF!important;border-color:#B05CFF!important;box-shadow:0 0 8px rgba(176,92,255,.88),inset 0 0 7px rgba(176,92,255,.34)!important;}
#game-stage .v169-material-art.v169-rarity-orange,#game-stage .v169-material-art.v169-rarity-perfect{color:#FF9F38!important;border-color:#FF9F38!important;box-shadow:0 0 9px rgba(255,159,56,.9),inset 0 0 8px rgba(255,159,56,.35)!important;}
#game-stage .v169-material-art.v169-rarity-pink{color:#FF4FA7!important;border-color:#FF4FA7!important;box-shadow:0 0 10px rgba(255,79,167,.92),inset 0 0 8px rgba(255,79,167,.36)!important;}
#game-stage .v169-material-art.v169-rarity-four-symbol{color:#fff!important;border-color:transparent!important;background:linear-gradient(#090b0f,#090b0f) padding-box,conic-gradient(#42A5FF,#47D6A3,#C89B45,#FF5A36,#42A5FF) border-box!important;box-shadow:0 0 9px rgba(255,90,54,.32),0 0 13px rgba(66,165,255,.32)!important;}
#game-stage #homeFeatureModal.v141-synthesis-modal{padding:4px!important;}
#game-stage #homeFeatureModal.v141-synthesis-modal .home-feature-modal-box{width:calc(100% - 8px)!important;max-width:none!important;height:calc(100% - 8px)!important;max-height:calc(100% - 8px)!important;}
#game-stage #dungeonPage:not(.v146-abyss-active) [data-dungeon-cover="equipment"] .v141-dungeon-cover-art{background-image:linear-gradient(180deg,transparent 58%,rgba(7,5,3,.38)),url("assets/dungeons/covers/equipment-v17363.png"),url("assets/dungeons/covers/equipment-v17343.png")!important;background-size:cover!important;background-position:center!important;}
#game-stage .v17363-text-reward-preview{width:min(392px,calc(100% - 18px))!important;max-width:392px!important;padding:18px!important;border:1px solid rgba(213,164,82,.82)!important;border-radius:15px!important;background:radial-gradient(circle at 50% 0,rgba(232,177,77,.16),transparent 36%),linear-gradient(160deg,#22170e,#090807 76%)!important;box-shadow:0 22px 52px rgba(0,0,0,.78),inset 0 0 0 1px rgba(255,231,171,.07)!important;}
#game-stage .v17363-preview-heading{text-align:left;padding-bottom:11px;margin-bottom:11px;border-bottom:1px solid rgba(196,149,75,.4);}
#game-stage .v17363-preview-heading small{display:block;color:#8f7956;font:700 9px/1.2 Cinzel,serif;letter-spacing:.2em;}
#game-stage .v17363-preview-heading h3{margin:4px 0 0;color:#f4d78f;font-family:"Noto Serif TC",serif;font-size:20px;line-height:1.35;letter-spacing:.04em;}
#game-stage .v17363-preview-groups{display:grid;gap:8px;}
#game-stage .v17363-preview-group{position:relative;padding:12px 13px;border:1px solid rgba(119,89,52,.7);border-radius:10px;background:linear-gradient(180deg,rgba(31,23,15,.96),rgba(13,10,8,.98));text-align:left;}
#game-stage .v17363-preview-group b{display:block;padding-right:80px;color:#f0d39a;font-size:14px;line-height:1.4;}
#game-stage .v17363-preview-group em{position:absolute;right:12px;top:11px;color:#e5b966;font:900 11px/1.4 Cinzel,"Noto Sans TC",sans-serif;font-style:normal;}
#game-stage .v17363-preview-group p{margin:6px 0 0;color:#cdbfa7;font-size:12px;line-height:1.72;}
#game-stage .v17363-preview-note{margin:10px 1px 0;padding:8px 10px;border-left:2px solid #b98b45;color:#9f927d;background:rgba(184,134,62,.06);font-size:11px;line-height:1.6;text-align:left;}
#game-stage .v17363-material-synthesis{display:grid;gap:8px;padding-bottom:8px;}
#game-stage .v17363-material-card{position:relative;padding:10px;border:1px solid rgba(154,112,58,.7);border-radius:11px;background:linear-gradient(180deg,#20170f,#0e0b08);overflow:visible;}
#game-stage .v17363-material-card h4{margin:0 0 3px;color:#f0ce85;font:900 16px/1.35 "Noto Serif TC",serif;}
#game-stage .v17363-material-card>p{margin:0 0 7px;color:#9f927f;font-size:10px;line-height:1.45;}
#game-stage .v17363-material-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;position:relative;z-index:12;}
#game-stage .v17363-material-controls.single{grid-template-columns:1fr;}
#game-stage .v17363-material-controls:not(.single)>.v17363-material-field:last-child:nth-child(odd){grid-column:1/-1;}
#game-stage .v17363-material-field{display:grid;gap:4px;min-width:0;color:#bbaa8c;font-size:10px;}
#game-stage .v17363-material-field-label{color:#bbaa8c;font-size:10px;line-height:1.3;}
#game-stage .v17363-game-select{position:relative;min-width:0;z-index:1;}
#game-stage .v17363-game-select.open{z-index:80;}
#game-stage .v17363-game-select-trigger{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;width:100%;min-height:36px;padding:5px 8px;border:1px solid #805e31;border-radius:7px;color:#ead9b5;background:linear-gradient(180deg,#21170e,#0b0907);font-size:11px;font-weight:800;text-align:left;box-shadow:inset 0 0 0 1px rgba(255,222,151,.03);}
#game-stage .v17363-game-select-trigger>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#game-stage .v17363-game-select-trigger>b{color:#d7ab59;font-size:12px;}
#game-stage .v17363-game-select.open .v17363-game-select-trigger{border-color:#d6a448;box-shadow:0 0 9px rgba(211,157,65,.2),inset 0 0 0 1px rgba(255,225,158,.14);}
#game-stage .v17363-game-select-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);display:none;max-height:205px;padding:5px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;border:1px solid #a0783a;border-radius:8px;background:linear-gradient(170deg,#281b0f,#090705);box-shadow:0 12px 30px rgba(0,0,0,.82),inset 0 0 0 1px rgba(255,222,151,.05);}
#game-stage .v17363-game-select.open .v17363-game-select-menu{display:grid;gap:3px;}
#game-stage .v17363-game-select-option{display:grid;grid-template-columns:auto minmax(0,1fr) 16px;align-items:center;gap:7px;width:100%;min-height:34px;padding:6px 8px;border:1px solid transparent;border-radius:6px;color:#d7c6a4;background:transparent;font-size:11px;font-weight:800;text-align:left;}
#game-stage .v17363-game-select-option.selected{border-color:#9d7336;background:linear-gradient(90deg,rgba(180,126,39,.2),rgba(72,46,16,.15));color:#ffe09a;}
#game-stage .v17363-game-select-option>b{color:#efbd55;text-align:center;}
#game-stage .v17363-menu-rarity-dot{display:block;width:10px;height:10px;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:#9d7136;box-shadow:0 0 5px rgba(255,255,255,.08);}
#game-stage .v17363-menu-rarity-dot.white{background:#d8d8d8;}#game-stage .v17363-menu-rarity-dot.blue{background:#42a5ff;}#game-stage .v17363-menu-rarity-dot.purple{background:#b05cff;}#game-stage .v17363-menu-rarity-dot.orange{background:#ff9f38;}#game-stage .v17363-menu-rarity-dot.pink{background:#ff4fa7;}#game-stage .v17363-menu-rarity-dot.neutral{background:#b68a48;}
#game-stage .v17363-material-flow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin:7px 0;padding:7px;border:1px solid rgba(116,87,49,.55);border-radius:9px;background:#090806;}
#game-stage .v17363-material-flow section{display:grid;gap:2px;justify-items:center;min-width:0;text-align:center;color:#cab996;font-size:10px;}
#game-stage .v17363-material-flow section>.v169-item-art,#game-stage .v17363-material-flow section>svg{width:70px!important;height:70px!important;max-width:70px!important;max-height:70px!important;margin:0 auto!important;}
#game-stage .v17363-material-flow section>.v169-item-art img{width:100%!important;height:100%!important;object-fit:contain!important;}
#game-stage .v17363-material-flow section b{max-width:100%;color:#f1d698;font-size:12px;line-height:1.25;overflow-wrap:anywhere;}
#game-stage .v17363-material-flow section span{font-size:10px;line-height:1.25;}
#game-stage .v17363-material-flow>i{color:#d3a34f;font-size:18px;font-style:normal;}
#game-stage .v17363-material-card .v17363-craft-button{width:100%;min-height:39px;border:1px solid #b88740;border-radius:8px;color:#1c1207;background:linear-gradient(180deg,#efd17f,#bd7d2c);font-weight:900;}
#game-stage .v17363-material-card .v17363-craft-button:disabled{filter:grayscale(.7);opacity:.45;}
`;
    document.head.appendChild(style);
}

/* ---------- 9. Material synthesis helpers. ---------- */
function oreByTier(tier){return defs().ores.find(item=>normalizeTier(item&&item.tierKey)===tier)||null;}
function blueprintsBy(tier,setId,slot){
    return defs().blueprints.filter(item=>item&&normalizeTier(item.tierKey)===tier&&(!setId||item.setId===setId)&&(!slot||item.blueprintSlot===slot));
}
function canAdd(definition,amount){return !window.v132CanAddItemToInventory||window.v132CanAddItemToInventory(definition,amount);}
function add(definition,amount){return !!(definition&&window.v132AddItemToInventory&&window.v132AddItemToInventory(definition,amount));}

/* ---------- 10. Material promotion: 50 same-tier -> 10 next-tier. ---------- */
function nextTier(tier){const index=TIER_ORDER.indexOf(normalizeTier(tier));return index>=0&&index<TIER_ORDER.length-1?TIER_ORDER[index+1]:null;}
function blueprintDef(tier,setId,slot){return blueprintsBy(normalizeTier(tier),setId,slot)[0]||null;}
function setOptions(){
    const map=new Map();
    defs().blueprints.forEach(item=>{if(item&&item.setId&&!map.has(item.setId)){const prefix=String(item.name||"").replace(/(白階|藍階|紫階|橙階|桃紅階|四象階).*$/,'');map.set(item.setId,prefix||item.setId);}});
    return [...map.entries()];
}
function tierChoices(){
    return TIER_ORDER.slice(0,-1).map(tier=>({value:tier,label:TIER_LABEL[tier]+" → "+TIER_LABEL[nextTier(tier)],tier}));
}
function materialGameSelect(key,label,choices,selected){
    const normalized=(choices||[]).map(choice=>Array.isArray(choice)?{value:String(choice[0]),label:String(choice[1])}:{value:String(choice.value),label:String(choice.label),tier:choice.tier});
    const current=normalized.find(choice=>choice.value===String(selected))||normalized[0]||{value:"",label:"未設定"};
    const dot=current.tier?'<i class="v17363-menu-rarity-dot '+esc(current.tier)+'"></i>':'';
    return '<div class="v17363-material-field"><span class="v17363-material-field-label">'+esc(label)+'</span><div class="v17363-game-select" data-material-key="'+esc(key)+'">'+
        '<button class="v17363-game-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" onclick="v17363ToggleMaterialMenu(this)">'+dot+'<span>'+esc(current.label)+'</span><b aria-hidden="true">▾</b></button>'+
        '<div class="v17363-game-select-menu" role="listbox">'+normalized.map(choice=>'<button class="v17363-game-select-option'+(choice.value===current.value?' selected':'')+'" type="button" role="option" aria-selected="'+(choice.value===current.value?'true':'false')+'" data-material-key="'+esc(key)+'" data-material-value="'+esc(choice.value)+'" onclick="v17363ChooseMaterialOption(this.dataset.materialKey,this.dataset.materialValue)">'+(choice.tier?'<i class="v17363-menu-rarity-dot '+esc(choice.tier)+'"></i>':'<i class="v17363-menu-rarity-dot neutral"></i>')+'<span>'+esc(choice.label)+'</span><b aria-hidden="true">'+(choice.value===current.value?'✓':'')+'</b></button>').join("")+'</div></div></div>';
}
function renderMaterialSynthesis(){
    const body=document.querySelector("#homeFeatureModalBody .v141-synthesis-body");
    if(!body){return;}
    const oreSource=oreByTier(MATERIAL_STATE.oreTier),oreTarget=oreByTier(nextTier(MATERIAL_STATE.oreTier));
    const bpSource=blueprintDef(MATERIAL_STATE.blueprintTier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const bpTarget=blueprintDef(nextTier(MATERIAL_STATE.blueprintTier),MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const sets=setOptions();
    const setChoices=sets.map(([value,label])=>({value,label}));
    const slotChoices=BLUEPRINT_SLOTS.map(slot=>({value:slot,label:SLOT_LABEL[slot]}));
    body.innerHTML='<div class="v17363-material-synthesis">'+
        '<section class="v17363-material-card"><h4>礦石升階</h4><p>同階礦石 50 個，可合成下一階礦石 10 個；最高可合至四象階。</p><div class="v17363-material-controls single">'+materialGameSelect("oreTier","升階路線",tierChoices(),MATERIAL_STATE.oreTier)+'</div>'+materialFlow(oreSource,oreTarget)+
        '<button class="v17363-craft-button" type="button" '+(!oreSource||ownedCount(oreSource.id)<50?'disabled':'')+' onclick="v17363CraftMaterial(&quot;ore&quot;)">合成下一階礦石 ×10</button></section>'+
        '<section class="v17363-material-card"><h4>設計圖升階</h4><p>同系列、同部位、同階設計圖 50 張，可合成下一階同款設計圖 10 張。</p><div class="v17363-material-controls">'+
        materialGameSelect("blueprintSet","系列",setChoices,MATERIAL_STATE.blueprintSet)+
        materialGameSelect("blueprintSlot","部位",slotChoices,MATERIAL_STATE.blueprintSlot)+
        materialGameSelect("blueprintTier","升階路線",tierChoices(),MATERIAL_STATE.blueprintTier)+'</div>'+materialFlow(bpSource,bpTarget)+
        '<button class="v17363-craft-button" type="button" '+(!bpSource||ownedCount(bpSource.id)<50?'disabled':'')+' onclick="v17363CraftMaterial(&quot;blueprint&quot;)">合成下一階設計圖 ×10</button></section></div>';
    repairSynthesisIcons();
}
function materialFlow(source,target){
    const sourceCount=source?ownedCount(source.id):0;
    return '<div class="v17363-material-flow"><section>'+(source&&source.icon||'')+'<b>'+esc(source&&source.name||"來源未建立")+'</b><span>'+sourceCount+' / 50</span></section><i>→</i><section>'+(target&&target.icon||'')+'<b>'+esc(target&&target.name||"已達最高階")+'</b><span>×10</span></section></div>';
}
window.v17363ToggleMaterialMenu=function(trigger){
    const root=trigger&&trigger.closest&&trigger.closest(".v17363-game-select");if(!root){return;}
    const opening=!root.classList.contains("open");
    document.querySelectorAll(".v17363-game-select.open").forEach(item=>{item.classList.remove("open");const button=item.querySelector(".v17363-game-select-trigger");if(button){button.setAttribute("aria-expanded","false");}});
    root.classList.toggle("open",opening);trigger.setAttribute("aria-expanded",opening?"true":"false");
};
window.v17363ChooseMaterialOption=function(key,value){
    if(!Object.prototype.hasOwnProperty.call(MATERIAL_STATE,key)){return;}
    MATERIAL_STATE[key]=String(value||"");renderMaterialSynthesis();
};
window.v17363SetMaterialOption=window.v17363ChooseMaterialOption;
document.addEventListener("click",event=>{
    document.querySelectorAll(".v17363-game-select.open").forEach(root=>{if(root.contains(event.target)){return;}root.classList.remove("open");const button=root.querySelector(".v17363-game-select-trigger");if(button){button.setAttribute("aria-expanded","false");}});
});
window.v17363CraftMaterial=function(kind){
    const isOre=kind==="ore";
    const tier=isOre?MATERIAL_STATE.oreTier:MATERIAL_STATE.blueprintTier;
    const targetTier=nextTier(tier);
    const source=isOre?oreByTier(tier):blueprintDef(tier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const target=isOre?oreByTier(targetTier):blueprintDef(targetTier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    if(!source||!target||!targetTier){alert("此道具已達最高可合成階級。");return false;}
    if(ownedCount(source.id)<50){alert("素材不足，需要「"+source.name+"」×50。");return false;}
    if(!canAdd(target,10)){alert("背包空間不足，無法放入合成結果。");return false;}
    const transaction=window.v132RunInventoryTransaction||function(operation){return !!operation();};
    const success=transaction(()=>window.v132ConsumeStackItem&&window.v132ConsumeStackItem(source.id,50)&&add(target,10));
    if(!success){alert("材料合成失敗，素材已自動還原。");return false;}
    refreshInventory();
    renderMaterialSynthesis();
    if(typeof window.rpgAlert==="function"){void window.rpgAlert("消耗「"+source.name+"」×50\n獲得「"+target.name+"」×10",{title:"材料合成成功",confirmText:"知道了",tone:"success"});}
    return true;
};
function ensureMaterialTab(){
    const tabs=document.querySelector("#homeFeatureModalBody .v141-synthesis-tabs");
    if(!tabs){return;}
    let button=tabs.querySelector('[data-v17363-material-tab="1"]');
    if(!button){
        button=document.createElement("button");button.type="button";button.dataset.v17363MaterialTab="1";button.textContent="材料合成";button.onclick=window.v17363OpenMaterialSynthesis;tabs.appendChild(button);
    }
    Array.from(tabs.querySelectorAll("button")).forEach(item=>item.classList.toggle("active",materialTabActive&&item===button||!materialTabActive&&item!==button&&item.classList.contains("active")));
    if(materialTabActive){Array.from(tabs.querySelectorAll("button")).forEach(item=>item.classList.toggle("active",item===button));}
}
const originalRenderSynthesis=typeof window.v141RenderSynthesis==="function"?window.v141RenderSynthesis:null;
const originalSwitchSynthesis=typeof window.v141SwitchSynthesisTab==="function"?window.v141SwitchSynthesisTab:null;
window.v17363OpenMaterialSynthesis=function(){
    materialTabActive=true;
    if(originalRenderSynthesis){originalRenderSynthesis();}
    ensureMaterialTab();renderMaterialSynthesis();maximizeSynthesisPanel();
};
if(originalRenderSynthesis){
    window.v141RenderSynthesis=function(){
        // Presentation data must be hydrated before V143 builds the first icon picker.
        if(typeof window.v17346SyncFourElementSets==="function"){try{window.v17346SyncFourElementSets();}catch(_){}}
        syncCanonicalItemArt();
        const result=originalRenderSynthesis.apply(this,arguments);
        ensureMaterialTab();if(materialTabActive){renderMaterialSynthesis();}
        repairSynthesisIcons();maximizeSynthesisPanel();scheduleRepairs();return result;
    };
}
if(originalSwitchSynthesis){
    window.v141SwitchSynthesisTab=function(){
        materialTabActive=false;const result=originalSwitchSynthesis.apply(this,arguments);ensureMaterialTab();scheduleRepairs();return result;
    };
}

/* ---------- 4. Force current return artwork on patrol/dungeon navigation. ---------- */
function syncReturnIcons(){
    document.querySelectorAll('img[src*="map-return.png"],img[src*="patrol-back.png"]').forEach(img=>{
        if(img.src&&!/assets\/ui\/map-return\.png(?:\?|$)/.test(img.getAttribute("src")||"")){img.setAttribute("src","assets/ui/map-return.png");}
    });
}

function runRepairs(){
    repairQueued=false;ensureFunctionalStyles();syncCanonicalItemArt();maximizeCharacterPanel();maximizeSynthesisPanel();maximizeDungeonBackpack();repairSynthesisIcons();ensureMaterialTab();syncReturnIcons();
}
function scheduleRepairs(){
    if(repairQueued){return;}repairQueued=true;
    if(typeof requestAnimationFrame==="function"){requestAnimationFrame(runRepairs);}else{setTimeout(runRepairs,0);}
}

/* Re-run after the established owners render or move the shared DOM. */
["renderInventoryItems","renderInventory","rebuildInventorySlots","openMapInventoryOverlay"].forEach(name=>{
    const previous=window[name];if(typeof previous!=="function"||previous.__v17363Wrapped){return;}
    const wrapped=function(){const result=previous.apply(this,arguments);scheduleRepairs();return result;};wrapped.__v17363Wrapped=true;window[name]=wrapped;
    try{if(name in globalThis){globalThis[name]=wrapped;}}catch(_){ }
});

ensureFunctionalStyles();runRepairs();
if(typeof MutationObserver!=="undefined"&&document.body){new MutationObserver(scheduleRepairs).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});}
document.addEventListener("click",scheduleRepairs,true);document.addEventListener("change",scheduleRepairs,true);window.addEventListener("resize",scheduleRepairs,{passive:true});
})();


/* bundled source: js/battlefield-render-geometry-adapter.js */
/* Fixed Slot Battlefield Rendering V2 — render geometry adapter.
   FourSymbolsBattlefieldSlots remains the only Slot/formation geometry owner.
   This adapter only reconciles legacy renderers/popups back onto that owner. */
(function installFixedSlotBattlefieldRenderGeometryV2(){
    "use strict";

    if(typeof window==="undefined"||window.__fixedSlotBattlefieldRenderGeometryV2Installed){ return; }
    const slots=window.FourSymbolsBattlefieldSlots;
    if(!slots){ return; }
    window.__fixedSlotBattlefieldRenderGeometryV2Installed=true;

    const VERSION="fixed-slot-render-v2";
    const LEGACY_PRESENTATION_STYLE_ID="v174-cardless-battle-style";
    const POPUP_ANCHORS=Object.freeze({
        damage:Object.freeze({x:.5,y:.28}),
        critical:Object.freeze({x:.5,y:.24}),
        heal:Object.freeze({x:.5,y:.28}),
        shield:Object.freeze({x:.5,y:.30}),
        miss:Object.freeze({x:.5,y:.26}),
        status:Object.freeze({x:.5,y:.42})
    });
    const VFX_SCALE_CONTRACT=Object.freeze({
        single:Object.freeze({shape:"single",scale:1}),
        tri:Object.freeze({shape:"tri",scale:1}),
        row:Object.freeze({shape:"row",scale:1}),
        column:Object.freeze({shape:"column",scale:1}),
        all:Object.freeze({shape:"all",scale:1})
    });

    let reconciling=false;
    let reconcileQueued=false;
    const pendingPopupAnchors=[];

    /* Cardless presentation is source CSS only. Remove the retired runtime
       stylesheet if an old session created it; never inject a replacement. */
    function neutralizeLegacyPresentationGeometry(){
        if(typeof document==="undefined"){ return; }
        const style=document.getElementById(LEGACY_PRESENTATION_STYLE_ID);
        if(style){ style.remove(); }
    }

    function integerIndexes(value){
        return Array.isArray(value)?value.filter(Number.isInteger).slice(0,10):[];
    }

    function activeEnemyIndexes(){
        try{
            return integerIndexes(typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]);
        }catch(_){ return []; }
    }

    function enemyRankWeight(index){
        try{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster&&monster.rank);
            return rank==="boss"?3:(rank==="elite"?2:1);
        }catch(_){ return 1; }
    }

    function activeEnemySnapshot(indexes){
        let snapshot=slots.getActiveEnemySnapshot();
        const requested=integerIndexes(indexes);
        const complete=snapshot&&requested.every(index=>!!slots.getEnemySlotForMonster(snapshot,index));
        if(!complete&&requested.length){
            snapshot=slots.createEnemyFormationSnapshot(requested,{
                originalFormationType:requested.length,
                rankWeight:enemyRankWeight
            });
            slots.setActiveEnemySnapshot(snapshot);
        }
        return snapshot;
    }

    function makeSlot(className,slot){
        const node=document.createElement("div");
        node.className=className;
        node.dataset.slot=slot;
        node.dataset.geometryOwner="fixed-slot";
        return node;
    }

    function applyPresentation(card,kind){
        const owner=window.FourSymbolsBattlePresentation;
        if(owner&&typeof owner.applyUnit==="function"){ owner.applyUnit(card,kind); }
    }

    function bossBattleOwner(){ return window.FourSymbolsBossBattle||null; }

    function canonicalizeEnemyZone(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        const indexes=activeEnemyIndexes();
        const snapshot=activeEnemySnapshot(indexes);
        if(!snapshot){ return; }

        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battleMonster"+index);
            if(card){ applyPresentation(card,"monster");cards.set(index,card); }
        });
        const bossOwner=bossBattleOwner();
        const bossIndex=bossOwner&&typeof bossOwner.getBossIndex==="function"?bossOwner.getBossIndex():null;
        const bossCard=Number.isInteger(bossIndex)?cards.get(bossIndex):null;

        const fragment=document.createDocumentFragment();
        [slots.enemyBackSlots,slots.enemyFrontSlots].forEach((rowSlots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-slot-row v-fixed-enemy-row";
            row.dataset.slotRow=rowIndex===0?"back":"front";
            row.dataset.geometryOwner="fixed-slot";
            rowSlots.forEach(slot=>{
                const holder=makeSlot("v-fixed-battle-slot v-fixed-enemy-slot",slot);
                const index=slots.getAssignedMonsterAtEnemySlot(snapshot,slot);
                const card=Number.isInteger(index)&&index!==bossIndex?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    card.dataset.geometryOwner="fixed-slot";
                    holder.appendChild(card);
                }
                row.appendChild(holder);
            });
            fragment.appendChild(row);
        });
        if(bossCard){
            const footprint=document.createElement("div");
            footprint.className="v-fixed-boss-footprint";
            footprint.dataset.geometryOwner="fixed-slot";
            footprint.dataset.slots=slots.bossFootprintSlots.join(" ");
            bossCard.classList.add("gameplay-boss-card");
            bossCard.dataset.slot="ENEMY_B3";
            bossCard.dataset.geometryOwner="fixed-slot";
            footprint.appendChild(bossCard);
            fragment.appendChild(footprint);
        }
        area.replaceChildren(fragment);
        area.classList.add("v-fixed-enemy-zone","v-fixed-zone-v2");
        area.classList.remove("battle-monsters","v131-formation","v141-fixed-formation");
        area.dataset.geometryOwner="fixed-slot";
        area.dataset.monsterCount=String(indexes.length);
        area.dataset.formationType=String(snapshot.originalFormationType||indexes.length);
        area.classList.toggle("gameplay-boss-active",!!bossCard);
    }

    function partyIndexes(){
        try{
            if(typeof getExistingPartyIndexes==="function"){
                return getExistingPartyIndexes().filter(Number.isInteger).slice(0,6);
            }
        }catch(_){ }
        return [0,1,2,3,4,5].filter(index=>!!document.getElementById("battlePlayerCard"+index));
    }

    function canonicalizeAllyZone(){
        const area=document.getElementById("battlePlayerRow");
        if(!area||typeof slots.ensureAllyFormation!=="function"){ return; }
        const indexes=partyIndexes();
        const formation=slots.ensureAllyFormation(indexes);
        if(!formation){ return; }
        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ applyPresentation(card,"player");cards.set(index,card); }
        });

        const fragment=document.createDocumentFragment();
        [slots.allyFrontSlots,slots.allyBackSlots].forEach((rowSlots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-slot-row v-fixed-ally-slot-row v-fixed-ally-slot-row-"+(rowIndex===0?"front":"back");
            row.dataset.slotRow=rowIndex===0?"front":"back";
            row.dataset.geometryOwner="fixed-slot";
            rowSlots.forEach(slot=>{
                const holder=makeSlot("v-fixed-unit-slot v-fixed-ally-slot",slot);
                const index=slots.getCharacterAtAllySlot(slot);
                const card=Number.isInteger(index)?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    card.dataset.geometryOwner="fixed-slot";
                    holder.appendChild(card);
                }
                row.appendChild(holder);
            });
            fragment.appendChild(row);
        });
        area.replaceChildren(fragment);
        area.classList.add("v-fixed-ally-formation","v-fixed-ally-zone","v-fixed-zone-v2");
        area.classList.remove("battle-player-row");
        area.dataset.geometryOwner="fixed-slot";
    }

    function markBattlefieldZones(){
        const page=document.getElementById("battlePage");
        if(page){ page.classList.add("v-fixed-slot-render-v2"); page.dataset.geometryOwner="fixed-slot"; }
        const info=document.querySelector("#battlePage .battle-info-region");
        if(info){ info.classList.add("v-fixed-battle-info-zone"); info.dataset.geometryOwner="fixed-slot"; }
        const action=document.getElementById("battleActionRegion")||document.getElementById("battleCommandRow");
        if(action){ action.classList.add("v-fixed-action-zone"); action.dataset.geometryOwner="fixed-slot"; }
    }

    function reconcile(){
        if(reconciling||typeof document==="undefined"){ return; }
        reconciling=true;
        try{
            neutralizeLegacyPresentationGeometry();
            markBattlefieldZones();
            canonicalizeEnemyZone();
            canonicalizeAllyZone();
        }finally{
            reconciling=false;
        }
    }

    function queueReconcile(){
        if(reconcileQueued){ return; }
        reconcileQueued=true;
        queueMicrotask(()=>{
            reconcileQueued=false;
            reconcile();
        });
    }

    function slotForElement(element){
        if(!element){ return null; }
        const direct=slots.getSlotFromElement(element);
        if(direct){ return direct; }
        const id=String(element.id||"");
        let match=id.match(/^battleMonster(\d+)$/);
        if(match){
            const snapshot=activeEnemySnapshot(activeEnemyIndexes());
            return snapshot?slots.getEnemySlotForMonster(snapshot,Number(match[1])):null;
        }
        match=id.match(/^battlePlayerCard(\d+)$/);
        if(match){ return slots.getAllySlotForCharacter(Number(match[1])); }
        return null;
    }

    function anchorForSlot(slot,kind){
        const rect=slot?slots.getSlotRect(slot):null;
        if(!rect){ return null; }
        const contract=POPUP_ANCHORS[kind]||POPUP_ANCHORS.damage;
        return {
            slot:slot,
            x:rect.left+rect.width*contract.x,
            y:rect.top+rect.height*contract.y,
            rect:rect
        };
    }

    function popupKind(popup,args){
        if(popup&&popup.classList&&popup.classList.contains("miss-popup")){ return "miss"; }
        const text=String((popup&&popup.textContent)||"");
        const type=String((args&&args[2])||"").toLowerCase();
        if(type.includes("heal")||text.startsWith("+")){ return "heal"; }
        if(type.includes("shield")){ return "shield"; }
        if(type.includes("buff")||type.includes("debuff")||type.includes("status")){ return "status"; }
        if(args&&args[3]===true){ return "critical"; }
        return "damage";
    }

    function applyPopupAnchor(popup,slot,kind){
        if(!popup||!slot){ return false; }
        const anchor=anchorForSlot(slot,kind);
        if(!anchor){ return false; }
        popup.dataset.slot=slot;
        popup.dataset.geometryOwner="fixed-slot";
        popup.dataset.popupKind=kind||"damage";
        popup.classList.add("v-fixed-slot-popup");
        popup.style.setProperty("position","fixed","important");
        popup.style.setProperty("left",anchor.x+"px","important");
        popup.style.setProperty("top",anchor.y+"px","important");
        popup.style.setProperty("font-size",kind==="critical"?"20px":"18px","important");
        popup.style.setProperty("transform","translate(-50%,-50%)","important");
        if(document.body&&popup.parentNode!==document.body){ document.body.appendChild(popup); }
        return true;
    }

    function newestPopup(before,selector,scope){
        const candidates=[];
        if(scope&&scope.querySelectorAll){ candidates.push(...scope.querySelectorAll(selector)); }
        if(document.body&&document.body.querySelectorAll){ candidates.push(...document.body.querySelectorAll(selector)); }
        for(let index=candidates.length-1;index>=0;index--){
            if(!before.has(candidates[index])){ return candidates[index]; }
        }
        return null;
    }

    function rememberPending(slot,kind){
        if(!slot){ return; }
        pendingPopupAnchors.push({slot:slot,kind:kind,expiresAt:Date.now()+2400});
        while(pendingPopupAnchors.length>24){ pendingPopupAnchors.shift(); }
    }

    function consumePending(popup){
        const now=Date.now();
        while(pendingPopupAnchors.length&&pendingPopupAnchors[0].expiresAt<now){ pendingPopupAnchors.shift(); }
        const pending=pendingPopupAnchors.shift();
        return pending?applyPopupAnchor(popup,pending.slot,pending.kind):false;
    }

    function wrapDamagePopup(){
        if(typeof window.showDamagePopup!=="function"||window.showDamagePopup.__fixedSlotPopupOwner){ return; }
        const previous=window.showDamagePopup;
        const wrapped=function(element){
            const args=Array.prototype.slice.call(arguments);
            const slot=slotForElement(element);
            const before=new Set(document.querySelectorAll(".damage-popup"));
            rememberPending(slot,"damage");
            const result=previous.apply(this,args);
            const popup=newestPopup(before,".damage-popup",element);
            if(popup){
                const kind=popupKind(popup,args);
                if(applyPopupAnchor(popup,slot,kind)){ pendingPopupAnchors.pop(); }
            }
            return result;
        };
        wrapped.__fixedSlotPopupOwner=true;
        wrapped.__previous=previous;
        window.showDamagePopup=wrapped;
        try{ showDamagePopup=wrapped; }catch(_){ }
    }

    function wrapMissPopup(){
        if(typeof window.showMissEffect!=="function"||window.showMissEffect.__fixedSlotPopupOwner){ return; }
        const previous=window.showMissEffect;
        const wrapped=function(isPlayerTarget,index){
            const side=isPlayerTarget?"player":"monster";
            const slot=slots.getSlotForCombatant(side,Number(index)||0,{enemySnapshot:slots.getActiveEnemySnapshot()});
            rememberPending(slot,"miss");
            return previous.apply(this,arguments);
        };
        wrapped.__fixedSlotPopupOwner=true;
        wrapped.__previous=previous;
        window.showMissEffect=wrapped;
        try{ showMissEffect=wrapped; }catch(_){ }
    }

    function geometryForVfx(targetSide,primarySlot,shape){
        const contract=VFX_SCALE_CONTRACT[shape]||VFX_SCALE_CONTRACT.single;
        let rect=null;
        if(contract.shape==="all"){
            rect=slots.getSideRect(targetSide);
        }else if(primarySlot){
            rect=slots.getGeometryRectFromShape(targetSide,primarySlot,contract.shape);
        }
        if(!rect){ return null; }
        return {
            owner:"fixed-slot",
            shape:contract.shape,
            scale:contract.scale,
            baseWidth:rect.width,
            baseHeight:rect.height,
            rect:rect,
            center:{x:rect.left+rect.width/2,y:rect.top+rect.height/2}
        };
    }

    const api=Object.freeze({
        version:VERSION,
        popupAnchors:POPUP_ANCHORS,
        vfxScaleContract:VFX_SCALE_CONTRACT,
        reconcile:reconcile,
        queueReconcile:queueReconcile,
        getSlotForElement:slotForElement,
        getAnchorForSlot:anchorForSlot,
        getVfxGeometry:geometryForVfx,
        neutralizeLegacyPresentationGeometry:neutralizeLegacyPresentationGeometry
    });
    window.FourSymbolsBattlefieldRenderGeometry=api;

    if(typeof window.renderBattle==="function"&&!window.renderBattle.__fixedSlotRenderV2){
        const previous=window.renderBattle;
        const wrapped=function(){
            const result=previous.apply(this,arguments);
            reconcile();
            return result;
        };
        wrapped.__fixedSlotRenderV2=true;
        window.renderBattle=wrapped;
        try{ renderBattle=wrapped; }catch(_){ }
    }

    neutralizeLegacyPresentationGeometry();
    wrapDamagePopup();
    wrapMissPopup();

    function isOwnedFixedStructure(node){
        if(!(node instanceof Element)||node.dataset.geometryOwner!=="fixed-slot"){ return false; }
        return !!node.matches?.(".v-fixed-slot-row,.v-fixed-enemy-slot,.v-fixed-ally-slot,.v-fixed-boss-footprint");
    }

    const observer=new MutationObserver(records=>{
        let needsReconcile=false;
        records.forEach(record=>{
            record.addedNodes.forEach(node=>{
                if(!(node instanceof Element)){ return; }
                const popups=node.matches&&node.matches(".damage-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup")||[]);
                popups.forEach(popup=>{
                    if(popup.dataset.geometryOwner==="fixed-slot"){ return; }
                    const card=popup.closest?.(".battle-player,.battle-monster,[data-slot]");
                    const slot=card?slotForElement(card):null;
                    if(slot){ applyPopupAnchor(popup,slot,popupKind(popup,[])); }
                    else{ consumePending(popup); }
                });
                /* Reconcile only legacy/new combat content. The fixed rows and
                   holders below are created by reconcile() itself; observing them
                   must not recursively schedule another reconcile forever. */
                if(isOwnedFixedStructure(node)){ return; }
                if(
                    node.id==="battleMonsterArea"||node.id==="battlePlayerRow"||
                    node.matches?.(".battle-monster,.battle-player,.v131-monster-row")||
                    node.querySelector?.(".battle-monster,.battle-player")
                ){
                    needsReconcile=true;
                }
            });
        });
        if(needsReconcile){ queueReconcile(); }
    });
    if(document.body){ observer.observe(document.body,{subtree:true,childList:true}); }

    reconcile();
})();
