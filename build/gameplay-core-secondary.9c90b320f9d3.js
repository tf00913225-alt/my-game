���z��
�)�֧u�ݢ�i��k�G��*^
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
    const SHOP_POTION_PRESENTATION=Object.freeze({
        hpPotion10:Object.freeze({name:"回春散",iconPath:"assets/items/potions/hp-potion-10-huichun.webp"}),
        hpPotion20:Object.freeze({name:"養命丹",iconPath:"assets/items/potions/hp-potion-20-yangming.webp"}),
        hpPotion30:Object.freeze({name:"大還丹",iconPath:"assets/items/potions/hp-potion-30-dahuan.webp"}),
        spPotion10:Object.freeze({name:"凝氣散",iconPath:"assets/items/potions/sp-potion-10-ningqi.webp"}),
        spPotion20:Object.freeze({name:"聚氣丹",iconPath:"assets/items/potions/sp-potion-20-juqi.webp"}),
        spPotion30:Object.freeze({name:"歸元丹",iconPath:"assets/items/potions/sp-potion-30-guiyuan.webp"})
    });
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

    function potionIconMarkup(path){
        return '<span class="v169-item-art v169-potion-art"><img src="'+escapeHtml(path)+'" alt="" aria-hidden="true" draggable="false" decoding="async" onerror="this.hidden=true"></span>';
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
                learnCost:15,maxLevel:5,spCost:45,targetType:"allyTri",duration:4,
                defenseBonusPercentByLevel:[15,20,25,30,35],requires:["petrifyFist","sandWind"],
                description:"使我方同排中、左、右最多3名存活角色提升防禦，持續4回合。"
            });
            delete rockWall.defenseBonusPercent;
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

    /* Player-facing skill text is owned by FourSymbolsSkillSpec after the
       gameplay bundle finishes loading. V144 no longer overrides previews. */

    /* 氣定神閒的命中提升要進入實際戰鬥能力，而不只停在描述。 */
    function accuracyMultiplier(character){
        if(!character||!Array.isArray(character.activeBuffs)){ return 1; }
        const active=character.activeBuffs.find(buff=>
            buff&&buff.type==="dinghaishenzhen"&&numeric(buff.turnsLeft)>0
        );
        return active?1+Math.max(0,numeric(active.accuracyBonusPercent))/100:1;
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
        const presentation=SHOP_POTION_PRESENTATION[id];
        let potion=potionDefinitions.find(item=>item&&item.id===id);
        if(!potion){
            potion={id:id,name:"",shortName:"",icon:"",type:"potion",resource:resource,recoveryPercent:percent,price:price,stats:{}};
            potionDefinitions.push(potion);
        }
        Object.assign(potion,{
            name:presentation?presentation.name:"回復"+percent+"%"+resource.toUpperCase()+"藥水",
            shortName:presentation?presentation.name:resource.toUpperCase()+" "+percent+"%",
            icon:presentation?potionIconMarkup(presentation.iconPath):(potion.icon||""),
            type:"potion",resource:resource,recoveryPercent:percent,price:price,stats:potion.stats||{}
        });
        if(typeof getPotionInventoryItems==="function"){
            getPotionInventoryItems(id).forEach(item=>{
                item.name=potion.name;
                item.shortName=potion.shortName;
                item.icon=potion.icon;
                item.type="potion";
                item.resource=potion.resource;
                item.recoveryPercent=potion.recoveryPercent;
                item.price=potion.price;
                item.stats={};
            });
        }
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
                    '<div class="shop-potion-summary"><div class="shop-potion-icon">'+item.icon+'</div><div class="shop-potion-copy">'+
                    '<div class="shop-potion-name">'+escapeHtml(item.name)+'</div><div class="shop-potion-effect">回復最大'+label+'的 '+item.recoveryPercent+'%</div></div></div>'+
                    '<div class="shop-potion-purchase-row"><label for="shopQuantity-'+item.id+'">數量</label><input id="shopQuantity-'+item.id+'" class="shop-potion-quantity" data-unit-price="'+price+'" type="number" inputmode="numeric" min="1" max="999" step="1" value="1" oninput="v146UpdateShopTotal(\''+item.id+'\')" onblur="v146CommitShopQuantity(\''+item.id+'\')">'+
                    '<span class="v146-shop-total" id="shopTotal-'+item.id+'">'+price+' 金幣</span><button class="home-feature-buy-btn shop-potion-buy" '+(gold<price?'disabled':'')+' onclick="buyShopItem(\''+item.id+'\',document.getElementById(\'shopQuantity-'+item.id+'\').value)">購買</button></div></div>';
            }).join("");
            return '<div class="v141-shop-wallet">目前金幣 <b>'+Math.max(0,Math.floor(numeric(gold))).toLocaleString("zh-TW")+'</b></div>'+
                '<div class="shop-potion-interface"><div class="shop-potion-note">只販售 HP／SP 10%、20%、30% 回復藥水</div>'+
                '<div class="v133-shop-tier-note">目前商店階級：'+tier.label+'（價格×'+tier.multiplier+'）</div><div class="shop-potion-list">'+cards+'</div></div>';
        };
    }

    if(typeof buyShopItem==="function"){
        buyShopItem=async function(itemId,requestedQuantity){
            if(!SHOP_POTION_IDS.includes(itemId)){ return false; }
            const item=getPotionDefinition(itemId);
            if(!item){ return false; }
            const quantity=typeof window.normalizeShopPurchaseQuantity==="function"
                ?window.normalizeShopPurchaseQuantity(requestedQuantity)
                :Math.max(1,Math.min(999,Math.floor(numeric(requestedQuantity)||1)));
            const unitPrice=shopUnitPrice(item);
            const totalPrice=unitPrice*quantity;
            if(
                typeof window.rpgConfirm==="function" &&
                !await window.rpgConfirm(
                    "確認購買「"+item.name+"」×"+quantity+"？\n將消耗 "+totalPrice.toLocaleString("zh-TW")+" 金幣。",
                    {title:"商店購買",confirmText:"確定購買",cancelText:"返回"}
                )
            ){
                return false;
            }
            if(gold<totalPrice){ alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。"); return false; }
            if(!addPotionToInventory(itemId,quantity)){ alert("背包已滿，或該藥水已沒有可用的堆疊空間。"); return false; }
            gold-=totalPrice;
            rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            const body=document.getElementById("homeFeatureModalBody");
            if(body){ body.innerHTML=renderShopContent(); }
            return true;
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

    function isMonsterSkillElementLegal(monster,skillId){
        if(!monster||!skillId||typeof skillDatabase==="undefined"){ return false; }
        const skill=skillDatabase[skillId];
        if(!skill){ return false; }
        const explicit=Array.isArray(monster.v144CrossElementSkillIds)
            ?monster.v144CrossElementSkillIds:[];
        if(explicit.includes(skillId)){ return true; }
        const skillElement=String(skill.element||"");
        const monsterElement=String(monster.element||"");
        return !!skillElement&&!!monsterElement&&skillElement===monsterElement;
    }

    function legalCarriedMonsterSkillIds(monster,kind){
        if(!monster){ return []; }
        const source=kind==="support"?monster.v141SupportSkillIds:monster.skillIds;
        return Array.from(new Set(Array.isArray(source)?source:[]))
            .filter(id=>isMonsterSkillElementLegal(monster,id));
    }

    function normalizeMonsterSkillLoadout(monster){
        if(!monster){ return monster; }
        monster.skillIds=legalCarriedMonsterSkillIds(monster,"attack");
        monster.v141SupportSkillIds=legalCarriedMonsterSkillIds(monster,"support");
        if(Array.isArray(monster.v144LegalSkillPool)){
            monster.v144LegalSkillPool=Array.from(new Set(monster.v144LegalSkillPool))
                .filter(id=>isMonsterSkillElementLegal(monster,id));
        }
        if(monster.v175ForcedAttackSkillId&&!monster.skillIds.includes(monster.v175ForcedAttackSkillId)){
            delete monster.v175ForcedAttackSkillId;
        }
        if(monster.v175ForcedSupportSkillId&&!monster.v141SupportSkillIds.includes(monster.v175ForcedSupportSkillId)){
            delete monster.v175ForcedSupportSkillId;
        }
        return monster;
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
        if(!monster){ return monster; }
        if(monster.v141Abyss){
            return normalizeMonsterSkillLoadout(monster);
        }
        if(monster.v132FixedSkillLoadout){
            normalizeMonsterSkillLoadout(monster);
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
        return normalizeMonsterSkillLoadout(monster);
    }

    window.v144IsMonsterSkillElementLegal=isMonsterSkillElementLegal;
    window.v144GetLegalMonsterSkillIds=legalCarriedMonsterSkillIds;
    window.v144NormalizeMonsterSkillLoadout=normalizeMonsterSkillLoadout;
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

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(roster){
            const options=arguments[2]&&typeof arguments[2]==="object"?arguments[2]:{};
            const encounterId=String(options.mode||"dungeon")+"-"+(++encounterSequence);
            (roster||[]).forEach(monster=>configureEncounterSkills(monster,encounterId));
            return previousLaunchDungeonBattle.apply(this,arguments);
        };
    }

    /* 共用 Dungeon launcher 會被 Daily/Tower/Boss/Adventure/Abyss 重用。
       Render 後只再次驗證正式攜帶技能，不再改寫 monster.element。 */
    let configuredDungeonBattleToken=null;
    function configureDungeonBattleSkillsAfterRender(){
        const roster=typeof monsters!=="undefined"?monsters:null;
        const token=typeof battleToken!=="undefined"?battleToken:null;
        if(
            window.v132ActiveDungeonRun&&
            token!==configuredDungeonBattleToken
        ){
            configuredDungeonBattleToken=token;
            const encounterId="dungeon-render-"+(++encounterSequence);
            (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]).forEach(index=>
                configureEncounterSkills(monsters[index],encounterId)
            );
        }
    }
    window.v144ConfigureDungeonBattleSkillsAfterRender=configureDungeonBattleSkillsAfterRender;

    function abyssAllies(){
        return (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[])
            .map(index=>({index:index,monster:monsters[index]}));
    }

    function hasV144Buff(monster,key){ return !!(monster&&monster[key]&&numeric(monster[key].turnsLeft)>0); }

    /* V144 no longer owns an enemy support dispatcher. The shared Skill-ID
       dispatcher in V141/V155 is the sole runtime owner. */

    /* Legacy V144 timed-buff round ticking is retired. Persistent durations
       are owned by FourSymbolsDurationLifecycle in the battle core. */

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

        const button=input.parentElement&&input.parentElement.querySelector(".shop-potion-buy");
        const raw=String(input.value==null?"":input.value).trim();

        /* Empty is a valid editing draft. Do not immediately turn it back into 1,
           otherwise the original default "1" can never be deleted on mobile. */
        if(raw===""){
            output.textContent="— 金幣";
            output.dataset.total="0";
            if(button){ button.disabled=true; }
            return 0;
        }

        const quantity=typeof window.normalizeShopPurchaseQuantity==="function"
            ?window.normalizeShopPurchaseQuantity(raw)
            :Math.max(1,Math.min(999,Math.floor(numeric(raw)||1)));
        input.value=String(quantity);
        const unitPrice=Math.max(0,Math.floor(numeric(input.dataset.unitPrice)));
        const total=quantity*unitPrice;
        output.textContent=total.toLocaleString("zh-TW")+" 金幣";
        output.dataset.total=String(total);
        if(button){ button.disabled=numeric(typeof gold!=="undefined"?gold:0)<total; }
        return total;
    };

    window.v146CommitShopQuantity=function(itemId){
        const input=document.getElementById("shopQuantity-"+itemId);
        if(!input){ return 1; }
        if(String(input.value==null?"":input.value).trim()===""){ input.value="1"; }
        window.v146UpdateShopTotal(itemId);
        return Number(input.value)||1;
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

    function showStatusPopup(entity,type){
        const label=STATUS_LABELS[type];
        const location=locateEntity(entity);
        const feedback=window.FourSymbolsBattleFloatingFeedback;
        if(!label||!location||!feedback||typeof feedback.emitAtImpact!=="function"){ return; }
        const emit=()=>feedback.emitAtImpact({side:location.side,index:location.index,kind:"status",statusType:type,text:label,phase:"status",source:"status"});
        if(
            window.__fourSymbolsBattleEffectSource==="relic"&&
            typeof window.v174QueueRelicVisual==="function"
        ){
            window.v174QueueRelicVisual(emit);
            return;
        }
        if(typeof queueMicrotask==="function"){ queueMicrotask(emit); }else{ emit(); }
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
        if(
            typeof monsters!=="undefined"&&
            Array.isArray(monsters)&&
            typeof currentBattleMonsters!=="undefined"&&
            Array.isArray(currentBattleMonsters)
        ){
            currentBattleMonsters.forEach(index=>{
                const monster=monsters[index];
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
                const eligibility=typeof getSkillLearnEligibilityForUi==="function"
                    ?getSkillLearnEligibilityForUi(character,skill,levels)
                    :null;
                if(eligibility&&eligibility.allowed){ canSpend=true; }
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
                const eligibility=typeof getSkillLearnEligibilityForUi==="function"
                    ?getSkillLearnEligibilityForUi(character,skill,levels)
                    :null;
                canSpend=!!(eligibility&&eligibility.allowed);
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
        syncCharacterAttentionDots();
    }
    if(typeof MutationObserver!=="undefined"){
        const observer=new MutationObserver(()=>{
            if(mutationQueued){ return; }
            mutationQueued=true;
            requestAnimationFrame(syncDynamicDom);
        });
        const startObserver=()=>{
            [
                document.getElementById("homeFeatureModal"),
                document.getElementById("dungeonPage")
            ].filter(Boolean).forEach(root=>observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]}));
        };
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

    /* Freeze and Petrify are one exclusive hard-control group. The canonical
       persistent-state owner in 00-main.js rejects same-name and cross-name
       applications before mutation. */
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

    function animateSupportCast(state,characterIndex,skill,targetId,targetIds,targetSide,targetTypeOverride){
        state.character.sp=Math.max(0,numeric(state.character.sp)-state.cost);
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        if(typeof showSkillNameBadge==="function"){
            showSkillNameBadge(skill.name,skill.element,characterIndex,targetId,targetIds,targetSide,targetTypeOverride);
        }
        if(typeof showPlayerSpPopup==="function"){
            setTimeout(()=>showPlayerSpPopup(state.cost,characterIndex),500);
        }
    }

    function requestedBuffTargets(characterIndex,queued,skill){
        const all=partyIndexes();
        const living=index=>{
            const target=getPartyCharacterByIndex(index);
            return !!(target&&numeric(target.hp)>0);
        };
        const targetingOwner=window.FourSymbolsBattleSkillTargeting;
        const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;

        if(targetingOwner&&typeof targetingOwner.resolveTargets==="function"){
            if(skill.targetType==="allyAll"){
                return targetingOwner.resolveTargets(
                    "player",null,"allyAll",{hostilePrimary:false}
                ).filter(living);
            }
            return targetingOwner.resolveTargets(
                "player",
                selected,
                skill.targetType==="allyTri"?"allyTri":"ally",
                {hostilePrimary:false}
            ).filter(living);
        }

        const owner=battlefieldSlots();
        if(owner&&typeof owner.ensureAllyFormation==="function"&&typeof owner.resolveAllyTargets==="function"){
            const formation=owner.ensureAllyFormation(all);
            if(skill.targetType==="allyAll"){
                return owner.resolveAllyTargets(formation,null,"all",living);
            }
            if(skill.targetType==="allyTri"){
                return owner.resolveAllyTargets(formation,selected,"allyTri",living);
            }
            return owner.resolveAllyTargets(formation,selected,"ally",living);
        }
        if(skill.targetType==="allyAll"){ return livingPartyIndexes(); }
        const target=getPartyCharacterByIndex(selected);
        return target&&numeric(target.hp)>0?[selected]:[];
    }

    function buffDuration(skill,level){
        return Math.max(1,Math.floor(
            levelValue(skill.durationByLevel,level,numeric(skill.duration)||2)
        ));
    }

    function buffFields(skill,level){
        if(skill.id==="rage"){
            const chance=levelValue(skill.critChanceBonusByLevel||skill.critBonusByLevel,level,0);
            const damage=levelValue(skill.critDamageBonusByLevel||skill.critBonusByLevel,level,0);
            return {bonusPercent:chance,critChanceBonusPercent:chance,critDamageBonusPercent:damage};
        }
        if(skill.id==="dodgeSkill"){
            return {percent:levelValue(skill.evasionBonusPercentByLevel,level,skill.evasionBonusPercent)};
        }
        if(skill.id==="rockWall"){
            return {percent:levelValue(skill.defenseBonusPercentByLevel,level,skill.defenseBonusPercent)};
        }
        if(skill.id==="earthShield"){
            return {
                percent:levelValue(skill.reflectPercentByLevel,level,skill.reflectPercent),
                remainingBlocks:Math.max(1,Math.floor(levelValue(skill.remainingBlocksByLevel,level,2)))
            };
        }
        if(skill.id==="dinghaishenzhen"){
            return {
                resistBonus:levelValue(skill.statusResistBonusByLevel,level,skill.statusResistBonus),
                accuracyBonusPercent:levelValue(skill.accuracyBonusPercentByLevel,level,skill.accuracyBonusPercent)
            };
        }
        if(skill.id==="barrier"){
            return {sourceSkill:"barrier",barrierRule:"duration"};
        }
        return {};
    }

    function selectedSupportPrimary(characterIndex,queued,targets){
        const selected=queued&&Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        return targets.includes(selected)?selected:targets[0];
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

        const primaryTarget=selectedSupportPrimary(characterIndex,queued,requested);
        animateSupportCast(state,characterIndex,skill,primaryTarget,requested,"player",skill.targetType);
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
                type:skill.id,turnsLeft:buffDuration(skill,state.level)
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

    function isRemovableTemporaryState(entry){
        return !!(entry&&entry.dispellable!==false&&entry.uncleansable!==true);
    }

    function removeRemovableStatusEffects(entity){
        if(!entity||!Array.isArray(entity.statusEffects)){ return 0; }
        const before=entity.statusEffects.length;
        entity.statusEffects=entity.statusEffects.filter(entry=>!isRemovableTemporaryState(entry));
        return before-entity.statusEffects.length;
    }

    function healAmounts(skill,state,targetStats,isFlatPartyHeal){
        const exSkill=typeof skillDatabase!=="undefined"?skillDatabase[skill.element+"EX"]:null;
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(state.key,skill.element+"EX"))));
        const multiplier=exSkill&&exLevel>0&&numeric(exSkill.healBonusPercent)>0
            ?1+numeric(exSkill.healBonusPercent)/100:1;
        const hpBase=levelValue(
            skill.healHpByLevel,
            state.level,
            numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(state.level-1)
        );
        const hp=isFlatPartyHeal
            ?Math.floor(hpBase*multiplier)
            :Math.floor(calculateHealingAmount(hpBase,state.stats.intelligence)*multiplier);
        const spPercent=levelValue(skill.spRestorePercentByLevel,state.level,0);
        const legacySpBase=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(state.level-1);
        const sp=isFlatPartyHeal&&Array.isArray(skill.spRestorePercentByLevel)
            ?Math.floor(numeric(targetStats.maxSP)*spPercent/100)
            :Math.floor(
                typeof calculateSPHealingAmount==="function"
                    ?calculateSPHealingAmount(legacySpBase,state.stats.intelligence)
                    :legacySpBase
            );
        return {hp:Math.max(0,hp),sp:Math.max(0,sp),maxHP:numeric(targetStats.maxHP),maxSP:numeric(targetStats.maxSP)};
    }

    function resolvePartyHeal(characterIndex,queued,skill,state){
        const targets=requestedBuffTargets(characterIndex,queued,skill);
        if(!targets.length){ return finishSupport(skill.name+"目前沒有可治療的存活目標。"); }
        const primaryTarget=selectedSupportPrimary(characterIndex,queued,targets);
        animateSupportCast(state,characterIndex,skill,primaryTarget,targets,"player",skill.targetType);
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
            if(skill.cleanseAll){
                cleansedTotal+=removeRemovableStatusEffects(target);
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

        animateSupportCast(state,characterIndex,skill,targetIndex,[targetIndex],"player",skill.targetType);
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

    function restoreRemovedMonsterTeamBuff(enemy,buff){
        if(!enemy||!buff){ return; }
        if(buff.type==="rage"){
            if(Number.isFinite(Number(buff.originalAttack))){ enemy.attack=Number(buff.originalAttack); }
            if(Number.isFinite(Number(buff.originalMagicAttack))){ enemy.magicAttack=Number(buff.originalMagicAttack); }
        }else if(buff.type==="resistance"){
            enemy.resistance=Math.max(0,numeric(enemy.resistance)-numeric(buff.amount));
        }else if(buff.type==="dodge"&&Number.isFinite(Number(buff.originalEvasion))){
            enemy.evasion=Number(buff.originalEvasion);
        }
    }

    function clearRemovableEntityStates(entity,side){
        if(!entity){ return 0; }
        let removed=removeRemovableStatusEffects(entity);

        if(side==="monster"&&typeof window.v155ClearRemovableCombatStates==="function"){
            removed+=Math.max(0,numeric(window.v155ClearRemovableCombatStates(entity)));
        }

        if(Array.isArray(entity.v141TeamBuffs)){
            const kept=[];
            entity.v141TeamBuffs.forEach(buff=>{
                if(isRemovableTemporaryState(buff)){
                    restoreRemovedMonsterTeamBuff(entity,buff);
                    removed++;
                }else{
                    kept.push(buff);
                }
            });
            entity.v141TeamBuffs=kept;
        }

        if(Array.isArray(entity.activeBuffs)){
            const before=entity.activeBuffs.length;
            entity.activeBuffs=entity.activeBuffs.filter(buff=>!isRemovableTemporaryState(buff));
            removed+=before-entity.activeBuffs.length;
        }

        if(entity.v141Shield&&isRemovableTemporaryState(entity.v141Shield)){
            entity.v141Shield=null;
            removed++;
        }
        return removed;
    }

    function purifyEnemyTargets(centerIndex,skillLevel){
        const targetCount=Math.max(1,Math.floor(levelValue(
            skillDatabase.purifyMind&&skillDatabase.purifyMind.targetCountByLevel,
            skillLevel,
            1
        )));
        if(targetCount<3||typeof getSkillTargets!=="function"){
            return monsterAlive(centerIndex)?[centerIndex]:[];
        }
        return getSkillTargets(centerIndex,"tri").filter(monsterAlive).slice(0,3);
    }

    f