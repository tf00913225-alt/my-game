/* =====================================================
   V143 — mobile combat readability, dungeon flow and rules
   This patch intentionally stays above the legacy engine: it fixes the
   current public behavior without reopening js/00-main.js.
===================================================== */
(function installV143SystemFixes(){
    "use strict";

    if(typeof window==="undefined" || window.__v143SystemFixesInstalled){ return; }
    window.__v143SystemFixesInstalled=true;

    const VERSION="143";
    const POTION_TARGET_ACTION="__v143PotionTarget";
    const TIER_META={
        low:{label:"低階",craftGold:500,main:[1,5],color:"#b88b58"},
        mid:{label:"中階",craftGold:1500,main:[3,8],color:"#5fb7df"},
        high:{label:"高階",craftGold:4000,main:[5,11],sub:[1,3],color:"#b788ed"},
        perfect:{label:"極品",craftGold:10000,main:[7,14],sub:[2,5],color:"#f0c35b"}
    };
    const SLOT_META={
        head:{label:"頭部",type:"head",glyph:"冠"},
        shoulder:{label:"護腕",type:"shoulder",glyph:"腕"},
        shoes:{label:"鞋子",type:"shoes",glyph:"履"},
        hand:{label:"武器",type:"weapon",glyph:"刃"},
        armor:{label:"衣服",type:"armor",glyph:"甲"}
    };
    const STAT_KEYS=["attack","intelligence"];
    const SUBSTAT_KEYS=["vitality","energy","agility","spirit"];
    const NORMAL_GEAR_PREFIXES=["古銅","精鍛","雲紋","玄鐵","旅者","守備","靈巧","秘銀"];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function svgIcon(glyph,color){
        const safeGlyph=escapeHtml(glyph);
        const safeColor=escapeHtml(color||"#d4aa61");
        return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="v143gear" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#332718"/><stop offset="1" stop-color="#090807"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="12" fill="url(#v143gear)" stroke="'+safeColor+'" stroke-width="3"/><path d="M12 46L20 18L32 11L44 18L52 46L32 55Z" fill="none" stroke="'+safeColor+'" stroke-opacity=".42" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="'+safeColor+'">'+safeGlyph+'</text></svg>';
    }

    /* ----- 11 / 12. Skill data and hard-control caps are one ruleset. ----- */
    function applySkillRuleChanges(){
        if(typeof skillDatabase==="undefined"){ return; }
        const storm=skillDatabase.stormRain;
        if(storm){
            storm.learnCost=30;
            storm.maxLevel=5;
            storm.baseDamage=48;
            storm.damagePerLevel=14;
            storm.spCost=75;
            storm.stunChance=35;
            storm.stunDuration=1;
            storm.missBonusByLevel=[30,45,50,55,65];
            storm.requires=["windHowlLightning"];
            storm.description="對敵方全體各造成48點基礎法術傷害；35%基礎機率暈眩1回合，使目標MISS率提高30%/45%/50%/55%/65%。";
        }
        const rain=skillDatabase.iceArrowRain;
        if(rain){
            rain.learnCost=20;
            rain.maxLevel=5;
            rain.baseDamage=30;
            rain.damagePerLevel=12;
            rain.spCost=75;
            rain.freezeChance=50;
            rain.freezeDuration=2;
            rain.freezeSingleTarget=true;
            rain.lifestealPercentByLevel=[1,2,3,4,5];
            rain.requires=["floodBeast"];
            rain.description="對敵方全體各造成30點基礎法術傷害；吸取實際傷害的1%/2%/3%/4%/5%恢復自身HP；另有50%基礎機率使隨機單一目標冰封2回合。";
        }
        const freeze=skillDatabase.freeze;
        if(freeze){
            freeze.learnCost=25;
            freeze.maxLevel=1;
            freeze.spCost=22;
            freeze.freezeChance=80;
            freeze.freezeDuration=4;
            freeze.requires=["iceArrowRain"];
            freeze.description="80%基礎機率冰封單一目標，使其無法行動4回合；純控場技能，不造成傷害。";
        }
    }
    applySkillRuleChanges();

    window.v143CombatRuleSnapshot=function(){
        return {
            version:VERSION,
            lockdownCaps:{regular:80,elite:45,boss:30},
            stormRain:skillDatabase&&skillDatabase.stormRain,
            iceArrowRain:skillDatabase&&skillDatabase.iceArrowRain,
            freeze:skillDatabase&&skillDatabase.freeze
        };
    };

    /* Ice Arrow Rain damages everyone, but rolls Freeze only once. */
    function playerIceRainTargets(centerIndex){
        if(typeof getSkillTargets!=="function"){ return []; }
        let center=Number.isInteger(centerIndex)?centerIndex:
            (typeof selectedMonster!=="undefined"?selectedMonster:0);
        if(typeof findAliveTargetIndex==="function"){ center=findAliveTargetIndex(center); }
        return center===null?[]:getSkillTargets(center,"all").slice();
    }

    function applySingleIceRainFreeze(casterIndex,targetIndexes){
        if(!targetIndexes.length || typeof rollStatusEffectHit!=="function"){ return; }
        const candidates=targetIndexes.filter(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            return monster&&monster.alive&&monster.hp>0;
        });
        if(!candidates.length){ return; }
        const index=candidates[Math.floor(Math.random()*candidates.length)];
        const monster=monsters[index];
        const caster=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(casterIndex):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(casterIndex):null;
        if(!caster||!stats){ return; }
        const hit=rollStatusEffectHit(
            50,caster.level,monster.level,stats.intelligence,
            typeof getMonsterEffectiveSpiritPoints==="function"?getMonsterEffectiveSpiritPoints(monster):numeric(monster.spiritPoints),
            true,typeof getMonsterRank==="function"?getMonsterRank(monster):"regular"
        );
        if(hit){
            applyFreezeEffect(monster,2);
            addBattleLog(monster.name+"被冰霜箭雨冰封2回合！");
            if(typeof updateMonsterUI==="function"){ updateMonsterUI(index); }
        }else{
            addBattleLog("冰霜箭雨的冰封效果被"+monster.name+"抵抗了。");
        }
    }

    function wrapPlayerIceRainFunction(name,casterIndexFromArgs,centerFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=arguments;
            const skillId=name==="castSecondaryCharacterSkill"?args[1]:args[0];
            if(skillId!=="iceArrowRain"){ return previous.apply(this,args); }
            const casterIndex=casterIndexFromArgs(args);
            const center=centerFromArgs(args);
            const targets=playerIceRainTargets(center);
            const skill=skillDatabase.iceArrowRain;
            const caster=getPartyCharacterByIndex(casterIndex);
            const beforeSp=caster?numeric(caster.sp):0;
            const chance=skill.freezeChance;
            skill.freezeChance=0;
            let result;
            try{ result=previous.apply(this,args); }
            finally{ skill.freezeChance=chance; }
            if(caster&&numeric(caster.sp)<beforeSp){ applySingleIceRainFreeze(casterIndex,targets); }
            return result;
        };
    }
    wrapPlayerIceRainFunction("castDamageSkill",()=>0,args=>typeof selectedMonster!=="undefined"?selectedMonster:0);
    wrapPlayerIceRainFunction("castSecondaryCharacterSkill",args=>Number(args[0])||0,args=>Number(args[2]));
    wrapPlayerIceRainFunction("castPlayer2Skill",()=>1,args=>Number(args[1]));

    /* Monster Ice Arrow Rain follows the same one-target Freeze rule. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousProcessSingleMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            let usedIceRain=false;
            const skill=typeof skillDatabase!=="undefined"?skillDatabase.iceArrowRain:null;
            const savedChance=skill?skill.freezeChance:0;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(skill&&name===skill.name){ usedIceRain=true; skill.freezeChance=0; }
                    return previousBadge.apply(this,arguments);
                };
            }
            let result;
            try{ result=previousProcessSingleMonsterAttack.apply(this,arguments); }
            finally{
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(skill){ skill.freezeChance=savedChance; }
            }
            if(usedIceRain&&skill){
                const living=(typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes():[0,1,2]).filter(index=>{
                    const character=getPartyCharacterByIndex(index);
                    return character&&character.hp>0;
                });
                if(living.length){
                    const targetIndex=living[Math.floor(Math.random()*living.length)];
                    const target=getPartyCharacterByIndex(targetIndex);
                    const caster=monsters[monsterIndex];
                    const spirit=typeof getFinalBattleSpiritForPlayerTarget==="function"
                        ?getFinalBattleSpiritForPlayerTarget(target,targetIndex):numeric(target.spirit);
                    if(rollStatusEffectHit(50,caster.level,target.level,numeric(caster.intelligencePoints),spirit,true,"regular",
                        typeof getPlayerStatusResistBonus==="function"?getPlayerStatusResistBonus(target):0)){
                        applyFreezeEffect(target,2);
                        addBattleLog((target.id||"角色")+"被冰霜箭雨冰封2回合！");
                        if(typeof updateUI==="function"){ updateUI(); }
                    }
                }
            }
            return result;
        };
    }

    /* ----- 1. Enemy card text: start large, only fit when it truly overflows. ----- */
    function fitEnemyIdentity(card,node){
        if(!card||!node){ return; }
        node.style.removeProperty("transform");
        node.style.removeProperty("width");
        node.style.setProperty("font-size","16px","important");
        const available=Math.max(1,node.clientWidth||card.clientWidth-6||68);
        let size=16;
        while(size>12 && node.scrollWidth>available){
            size--;
            node.style.setProperty("font-size",size+"px","important");
        }
        if(node.scrollWidth>available){
            const scale=Math.max(.72,available/node.scrollWidth);
            node.style.setProperty("transform","scaleX("+scale+")");
        }
        node.dataset.v143FontSize=String(size);
    }

    function decorateEnemyCard(index){
        const card=document.getElementById("battleMonster"+index);
        const monster=typeof monsters!=="undefined"?monsters[index]:null;
        if(!card||!monster){ return; }
        const name=card.querySelector(".battle-monster-name");
        const level=card.querySelector(".battle-monster-level");
        if(!name){ return; }
        const identity=monster.name+" Lv"+monster.level;
        if(name.textContent.trim()!==identity){ name.textContent=identity; }
        name.classList.add("v143-monster-identity");
        if(level){ level.hidden=true; level.setAttribute("aria-hidden","true"); }
        fitEnemyIdentity(card,name);
        fitEnemyBars(card);
    }

    function fitEnemyBars(card){
        card.querySelectorAll(".monster-bar-text").forEach(node=>{
            node.style.removeProperty("transform");
            node.style.setProperty("font-size","13px","important");
            const available=Math.max(1,node.clientWidth||68);
            let size=13;
            while(size>11&&node.scrollWidth>available){
                size--;
                node.style.setProperty("font-size",size+"px","important");
            }
            if(node.scrollWidth>available){
                node.style.setProperty("transform","scaleX("+Math.max(.82,available/node.scrollWidth)+")");
            }
            node.dataset.v143FontSize=String(size);
        });
    }

    function decorateEnemyCards(){
        if(typeof currentBattleMonsters==="undefined"){ return; }
        currentBattleMonsters.forEach(decorateEnemyCard);
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            decorateEnemyCards();
            if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(decorateEnemyCards); }
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            decorateEnemyCard(index);
            syncEarthShieldEffects();
            syncMonsterBarrierText(index);
            const card=document.getElementById("battleMonster"+index);
            if(card){ fitEnemyBars(card); }
            return result;
        };
    }

    /* ----- 7. Wanxiang Earth Shield owns a four-corner elemental frame. ----- */
    function hasActiveBuffType(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function syncEarthShieldCard(card,entity){
        if(!card){ return; }
        if(card.classList.contains("v143-effects-pending")){ return; }
        let layer=card.querySelector(":scope > .v141-card-effects");
        if(!layer){
            layer=document.createElement("div");
            layer.className="v141-card-effects";
            layer.setAttribute("aria-hidden","true");
            card.appendChild(layer);
        }
        const active=hasActiveBuffType(entity,"earthShield");
        let effect=layer.querySelector(":scope > .v143-earth-shield-effect");
        if(active&&!effect){
            effect=document.createElement("span");
            effect.className="v143-earth-shield-effect";
            effect.innerHTML="<i></i><i></i><i></i><i></i><b>象</b>";
            layer.appendChild(effect);
        }else if(!active&&effect){ effect.remove(); }
        const realBarrier=hasActiveBuffType(entity,"barrier")||!!(entity&&entity.v141Shield&&entity.v141Shield.isBarrier);
        const oldBarrier=layer.querySelector(":scope > .v141-effect-barrier");
        if(active&&!realBarrier&&oldBarrier){ oldBarrier.remove(); }
        if(realBarrier&&!oldBarrier){
            const barrier=document.createElement("span");
            barrier.className="v141-effect v141-effect-barrier";
            layer.insertBefore(barrier,layer.firstChild||null);
        }
    }

    function syncEarthShieldEffects(){
        if(typeof document==="undefined"){ return; }
        for(let index=0;index<3;index++){
            const entity=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            syncEarthShieldCard(document.getElementById("battlePlayerCard"+index),entity);
        }
        if(typeof currentBattleMonsters!=="undefined"){
            currentBattleMonsters.forEach(index=>syncEarthShieldCard(
                document.getElementById("battleMonster"+index),monsters[index]
            ));
        }
    }
    window.v143SyncEarthShieldEffects=syncEarthShieldEffects;

    /* ----- 10. Both sides use five direct blocks / five rounds for Barrier. ----- */
    function isMonsterBarrier(monster){
        return !!(monster&&monster.v141Shield&&monster.v141Shield.isBarrier);
    }

    function removeMonsterBarrier(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return; }
        monster.maxHP=Math.max(1,numeric(shield.baseMaxHP)||numeric(monster.maxHP));
        monster.hp=Math.max(0,Math.min(monster.maxHP,numeric(shield.baseHp)));
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
        monster.v141Shield=null;
    }

    if(typeof window.v141ApplyMonsterShield==="function"){
        const previousApplyMonsterShield=window.v141ApplyMonsterShield;
        window.v141ApplyMonsterShield=function(monster,amount,turns){
            const barrier=numeric(amount)>=999999;
            const result=previousApplyMonsterShield.call(this,monster,barrier?1:amount,barrier?5:turns);
            if(barrier&&monster&&monster.v141Shield){
                monster.v141Shield.isBarrier=true;
                monster.v141Shield.turnsLeft=5;
                monster.v141Shield.remainingBlocks=5;
                monster.v141Shield.barrierRule="shared";
            }
            return result;
        };
    }

    let directPlayerActionDepth=0;
    function wrapDirectPlayerAction(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            directPlayerActionDepth++;
            try{ return previous.apply(this,arguments); }
            finally{ directPlayerActionDepth=Math.max(0,directPlayerActionDepth-1); }
        };
    }
    ["normalAttack","secondaryCharacterNormalAttack","windArrowAttack"].forEach(wrapDirectPlayerAction);

    function currentAnimationIsPlayerAttack(){
        const current=window.v143SkillAnimationState&&window.v143SkillAnimationState.current;
        return !!(current&&!current.done&&current.side==="player");
    }

    if(typeof addBattleLog==="function"){
        const previousBattleLog=addBattleLog;
        addBattleLog=function(message){
            let text=String(message);
            if((directPlayerActionDepth>0||currentAnimationIsPlayerAttack())&&/造成\d+傷害/.test(text)&&typeof currentBattleMonsters!=="undefined"){
                const blocked=currentBattleMonsters.map(index=>monsters[index]).find(monster=>
                    isMonsterBarrier(monster)&&text.indexOf(monster.name)>=0
                );
                if(blocked){ text=text.replace(/造成\d+傷害/,"造成0傷害（結界格擋）"); }
            }
            const args=Array.prototype.slice.call(arguments);
            args[0]=text;
            return previousBattleLog.apply(this,args);
        };
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type){
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            if(!monster||type!=="hp"||!isMonsterBarrier(monster)){
                return previousShowMonsterHit.apply(this,arguments);
            }
            const shield=monster.v141Shield;
            const damage=Math.max(0,numeric(amount));
            const direct=directPlayerActionDepth>0||currentAnimationIsPlayerAttack();
            if(direct){
                monster.hp=Math.max(0,numeric(shield.baseHp))+Math.max(0,numeric(shield.remaining));
                shield.remainingBlocks=Math.max(0,(numeric(shield.remainingBlocks)||5)-1);
                const card=document.getElementById("battleMonster"+index);
                if(card&&typeof showDamagePopup==="function"){ showDamagePopup(card,"格擋 "+shield.remainingBlocks,"shield"); }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",index,"barrier"); }
                addBattleLog(monster.name+"的結界抵擋直接傷害（剩餘"+shield.remainingBlocks+"次）。");
                if(shield.remainingBlocks<=0){ removeMonsterBarrier(monster); }
                syncMonsterBarrierText(index);
                return;
            }
            /* DOT bypasses Barrier without consuming a block. */
            shield.baseHp=Math.max(0,numeric(shield.baseHp)-damage);
            monster.hp=shield.baseHp+Math.max(0,numeric(shield.remaining));
            if(shield.baseHp<=0){ removeMonsterBarrier(monster); monster.hp=0; }
            return previousShowMonsterHit.apply(this,arguments);
        };
    }

    function syncMonsterBarrierText(index){
        const monster=typeof monsters!=="undefined"?monsters[index]:null;
        if(!isMonsterBarrier(monster)){ return; }
        const shield=monster.v141Shield;
        if(!Number.isFinite(Number(shield.remainingBlocks))){ shield.remainingBlocks=5; }
        const text=document.getElementById("battleMonsterHPText"+index);
        if(text){ text.textContent=Math.floor(numeric(shield.baseHp))+"/"+Math.floor(numeric(shield.baseMaxHP))+" 結界"+shield.remainingBlocks; }
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(){
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    args[0]=String(message).replace("完全防護4回合","抵擋5次直接傷害，最多5回合");
                    return previousLog.apply(this,args);
                };
            }
            try{ return previousSpecial.apply(this,arguments); }
            finally{ if(previousLog){ addBattleLog=previousLog; } }
        };
    }

    /* ----- 8 / 9. A potion may target any valid ally; cards use the same reticle. ----- */
    function queuedPotionReservations(potionId){
        if(typeof queuedPlayerActions==="undefined"){ return 0; }
        return Object.keys(queuedPlayerActions||{}).reduce((sum,key)=>{
            const action=queuedPlayerActions[key];
            return sum+(action&&action.action==="potion"&&action.potionId===potionId?1:0);
        },0);
    }

    function validPotionTarget(potionId,index){
        const definition=typeof getPotionDefinition==="function"?getPotionDefinition(potionId):null;
        const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(index):null;
        if(!definition||!character||!stats||character.hp<=0){ return false; }
        return definition.resource==="hp"?character.hp<stats.maxHP:character.sp<stats.maxSP;
    }

    if(typeof getBattleActionDisplayName==="function"){
        const previousDisplayName=getBattleActionDisplayName;
        getBattleActionDisplayName=function(actionType){
            if(actionType===POTION_TARGET_ACTION){
                const pending=window.v143PendingPotionTarget;
                const definition=pending&&getPotionDefinition(pending.potionId);
                return definition?definition.name:"使用物品";
            }
            return previousDisplayName.apply(this,arguments);
        };
    }

    if(typeof usePotion==="function"){
        usePotion=function(potionId){
            const definition=getPotionDefinition(potionId);
            const autoOn=activeBattleCharacterIndex===0?autoBattle:getPartyAutoConfig(activeBattleCharacterIndex).enabled;
            const caster=getPartyCharacterByIndex(activeBattleCharacterIndex);
            if(!definition||!battleActive||autoOn||actionReady||!caster||caster.hp<=0){ return; }
            const available=getPotionCount(potionId)-queuedPotionReservations(potionId);
            if(available<=0){ addBattleLog(definition.name+"已被其他角色預定或沒有庫存。"); return; }
            const valid=(typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes():[0,1,2])
                .filter(index=>validPotionTarget(potionId,index));
            if(!valid.length){ addBattleLog((definition.resource==="hp"?"所有存活角色HP":"所有存活角色SP")+"都已經是滿的。"); return; }
            actionReady=true;
            pendingAction=POTION_TARGET_ACTION;
            window.v143PendingPotionTarget={potionId:potionId,casterIndex:activeBattleCharacterIndex};
            closeMenus();
            const region=document.getElementById("battleActionRegion");
            if(region){ region.classList.add("target-selecting"); }
            const prompt=document.getElementById("battleTargetPromptAction");
            if(prompt){ prompt.textContent="選擇要使用［"+definition.name+"］的角色"; }
            currentBattleMonsters.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.remove("targetable","target"); }
            });
            [0,1,2].forEach(index=>{
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){ card.classList.toggle("ally-targetable",valid.indexOf(index)>=0); }
            });
            const targetText=document.getElementById("battleTarget");
            if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
        };
    }

    if(typeof selectBattleAllyTarget==="function"){
        const previousSelectAlly=selectBattleAllyTarget;
        selectBattleAllyTarget=function(index){
            const pending=window.v143PendingPotionTarget;
            if(pendingAction!==POTION_TARGET_ACTION||!pending){ return previousSelectAlly.apply(this,arguments); }
            if(!battleActive||battlePhase!=="declare"||!actionReady||!validPotionTarget(pending.potionId,index)){ return; }
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();
            queuedPlayerActions[pending.casterIndex]={
                action:"potion",potionId:pending.potionId,target:null,targetAlly:index
            };
            window.v143PendingPotionTarget=null;
            finishPlayerAction();
        };
    }

    if(typeof returnFromBattleTargetSelection==="function"){
        const previousReturnFromTarget=returnFromBattleTargetSelection;
        returnFromBattleTargetSelection=function(){
            const wasPotion=pendingAction===POTION_TARGET_ACTION;
            const result=previousReturnFromTarget.apply(this,arguments);
            if(wasPotion){ window.v143PendingPotionTarget=null; }
            return result;
        };
    }

    if(typeof applyPotionEffect==="function"){
        const previousApplyPotion=applyPotionEffect;
        applyPotionEffect=function(potionId,characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"&&queuedPlayerActions[characterIndex];
            const target=queued&&Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
            window.v143LastPotionEffectTarget={index:target,at:Date.now()};
            const caster=getPartyCharacterByIndex(characterIndex);
            const receiver=getPartyCharacterByIndex(target);
            const definition=getPotionDefinition(potionId);
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog&&caster&&receiver&&characterIndex!==target){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    const expected=(receiver.id||"你")+"使用"+(definition&&definition.name||"");
                    if(String(args[0]).indexOf(expected)>=0){
                        args[0]=String(args[0]).replace(expected,(caster.id||"角色")+"對"+(receiver.id||"隊友")+"使用"+(definition&&definition.name||"物品"));
                    }
                    return previousLog.apply(this,args);
                };
            }
            try{ return previousApplyPotion.call(this,potionId,target); }
            finally{ if(previousLog&&caster&&receiver&&characterIndex!==target){ addBattleLog=previousLog; } }
        };
    }

    /* ----- 3. Escaping a dungeon restores the dungeon owner before routing. ----- */
    if(typeof resolveEscapeAttempt==="function"){
        const previousEscape=resolveEscapeAttempt;
        resolveEscapeAttempt=function(characterIndex){
            const run=window.v132ActiveDungeonRun;
            if(!run){ return previousEscape.apply(this,arguments); }
            clearInterval(timerId);
            timerId=null;
            const alive=currentBattleMonsters.map(index=>monsters[index]).filter(monster=>monster&&monster.alive);
            if(!alive.length){ checkBattleEnd(); return; }
            const highest=Math.max.apply(null,alive.map(monster=>monster.level));
            const character=getPartyCharacterByIndex(characterIndex)||player;
            const chance=Math.max(10,Math.min(95,50+(numeric(character.level)-highest)*5));
            if(Math.random()*100>=chance){ addBattleLog("逃脫失敗！"); finishPlayerAction(); return; }

            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            battleToken++;
            if(typeof battleAdvanceTimeoutId!=="undefined"&&battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId); battleAdvanceTimeoutId=null;
            }
            if(typeof battleAdvanceScheduled!=="undefined"){ battleAdvanceScheduled=false; }
            closeMenus();
            if(window.v142SkillAnimationDirector){ window.v142SkillAnimationDirector.dispose(); }
            document.querySelectorAll("#v141BattleTransition,.v141-battle-transition").forEach(node=>node.classList.remove("show"));
            const battlePage=document.getElementById("battlePage");
            if(battlePage){ battlePage.classList.remove("preparing","v141-exiting"); }
            monsters=run.previousMonsters;
            currentZone=run.previousZone;
            window.v132ActiveDungeonRun=null;
            addBattleLog("成功從副本脫逃！");
            if(typeof saveGame==="function"){ saveGame(); }
            setTimeout(()=>{
                if(typeof run.onComplete==="function"){ run.onComplete({result:"escape"}); }
                else{
                    showPage("dungeon");
                    if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
                }
            },260);
        };
    }

    /* ----- 4 / 5. Larger Abyss, tap-to-advance dialogue and correct nav shell. ----- */
    function fixDungeonNavigation(){
        const nav=document.getElementById("v141DungeonNav");
        const content=document.getElementById("game-content");
        if(!nav||!content){ return; }
        if(nav.parentElement!==content){ content.appendChild(nav); }
        nav.innerHTML=
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'character\')" aria-label="角色"><img class="nav-art-button" src="assets/ui/nav-character.png" alt=""><span class="nav-sr-only">角色</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openMapInventoryOverlay()" aria-label="背包"><img class="nav-art-button" src="assets/ui/nav-backpack.png" alt=""><span class="nav-sr-only">背包</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'shop\')" aria-label="商店"><img class="nav-art-button" src="assets/ui/home-shop.png" alt=""><span class="nav-sr-only">商店</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'autoBattleSettings\')" aria-label="元素匣"><img class="nav-art-button" src="assets/ui/nav-element-box.png" alt=""><span class="nav-sr-only">元素匣</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="showPage(\'home\')" aria-label="返回"><img class="nav-art-button" src="assets/ui/map-return.png" alt=""><span class="nav-sr-only">返回</span></button>';
        nav.dataset.v143Fixed="1";
        const oldReturn=document.getElementById("v141DungeonReturn");
        if(oldReturn){ oldReturn.remove(); }
    }

    const ABYSS_DIALOGUE={
        1:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"],
        2:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"],
        3:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"],
        4:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"],
        5:["五帝同臨，你已無路可退。","極光會照見你的敗亡。","此處便是深淵盡頭！"]
    };

    if(typeof window.v141ChallengeAbyssBoss==="function"){
        const previousChallenge=window.v141ChallengeAbyssBoss;
        window.v141ChallengeAbyssBoss=function(){
            const map=document.getElementById("v141AbyssMap");
            if(!map||map.querySelector(".v143-abyss-dialogue")){ return; }
            const heading=document.querySelector(".v141-abyss-shell > header b");
            const match=heading&&heading.textContent.match(/第\s*(\d+)/);
            const floor=Math.max(1,Math.min(5,Number(match&&match[1])||1));
            const boss=map.querySelector(".v141-abyss-boss b");
            const lines=(ABYSS_DIALOGUE[floor]||ABYSS_DIALOGUE[1]).slice();
            let index=0;
            const overlay=document.createElement("button");
            overlay.type="button";
            overlay.className="v143-abyss-dialogue";
            overlay.innerHTML='<small>'+escapeHtml(boss&&boss.textContent||"守關者")+'</small><b></b><span>點擊畫面繼續　'+(index+1)+' / '+lines.length+'</span>';
            const text=overlay.querySelector("b");
            const hint=overlay.querySelector("span");
            text.textContent=lines[index];
            overlay.onclick=event=>{
                event.preventDefault(); event.stopPropagation();
                index++;
                if(index<lines.length){
                    text.textContent=lines[index];
                    hint.textContent="點擊畫面繼續　"+(index+1)+" / "+lines.length;
                    return;
                }
                text.textContent="進入戰鬥……";
                hint.textContent="";
                overlay.disabled=true;
                window.__v143AbyssDialogueComplete=true;
                setTimeout(()=>{ overlay.remove(); previousChallenge(); },180);
            };
            map.appendChild(overlay);
        };
    }

    /* ----- 6. Synthesis uses icon pickers and creates ordinary random gear. ----- */
    function definitions(){
        return window.v132GetContentDefinitions?window.v132GetContentDefinitions():{ores:[],talismans:[]};
    }
    function countItem(itemId){
        return (typeof inventoryItems!=="undefined"?inventoryItems:[]).reduce((sum,item)=>
            sum+(item&&item.id===itemId?Math.max(0,numeric(item.count)):0),0
        );
    }
    function rollUniform(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
    function rollNormalAffixes(tier){
        if(typeof window.v141RollCraftAffixes==="function"){ return window.v141RollCraftAffixes(tier,false); }
        const meta=TIER_META[tier];
        const stats={};
        stats[STAT_KEYS[Math.floor(Math.random()*STAT_KEYS.length)]]=rollUniform(meta.main[0],meta.main[1]);
        if(meta.sub){ stats[SUBSTAT_KEYS[Math.floor(Math.random()*SUBSTAT_KEYS.length)]]=rollUniform(meta.sub[0],meta.sub[1]); }
        return stats;
    }
    function synthesisResult(item){
        if(!window.v132ShowRewardModal){ return; }
        const labels={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",agility:"敏捷",spirit:"精神"};
        const stats=Object.keys(item.stats||{}).map(key=>'<span>'+labels[key]+' <b>+'+item.stats[key]+'</b></span>').join("");
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>合成成功</h3><div class="v141-result-item">'+item.icon+'<b>'+escapeHtml(item.name)+'</b>'+stats+'</div><p>此為系統隨機生成的普通裝備，不屬於四大套裝。</p><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">確定</button></div></div>');
    }

    window.v141CraftEquipment=function(){
        const select=document.querySelector(".v141-synthesis-body select");
        const blueprint=select&&(inventoryItems||[]).find(item=>item&&item.id===select.value&&item.blueprintSlot);
        if(!blueprint){ return; }
        const tier=blueprint.tierKey;
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const ore=definitions().ores.find(item=>item.tierKey===tier);
        if(!meta||!ore||countItem(blueprint.id)<50||countItem(ore.id)<50||numeric(gold)<meta.craftGold){ alert("素材或金幣不足。"); return; }
        const item={
            id:"normal_crafted_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
            v141Uid:"gear_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
            name:NORMAL_GEAR_PREFIXES[Math.floor(Math.random()*NORMAL_GEAR_PREFIXES.length)]+meta.label+slot.label,
            icon:svgIcon(slot.glyph,meta.color),type:slot.type,tierKey:tier,levelRequirement:1,
            price:0,count:1,stats:rollNormalAffixes(tier),reforgeStats:null,
            v141Crafted:true,v143NormalCraft:true
        };
        delete item.setId;
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        const transaction=window.v132RunInventoryTransaction||function(operation){ return !!operation(); };
        const success=transaction(()=>
            window.v132ConsumeStackItem(blueprint.id,50)&&
            window.v132ConsumeStackItem(ore.id,50)&&
            window.v132AddItemToInventory(item,1)
        );
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=meta.craftGold;
        rebuildInventorySlots(); updateGoldDisplay(); saveGame();
        window.v141RenderSynthesis();
        synthesisResult(item);
    };

    function allEquipment(){
        const result=[];
        (inventoryItems||[]).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } });
        Object.values(typeof characterEquipment!=="undefined"&&characterEquipment||{}).forEach(slots=>
            Object.values(slots||{}).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } })
        );
        return result;
    }
    function iconForPickerValue(value){
        const content=definitions();
        const item=(inventoryItems||[]).find(candidate=>candidate&&(candidate.id===value||candidate.v141Uid===value))||
            allEquipment().find(candidate=>candidate.v141Uid===value)||
            (content.talismans||[]).find(candidate=>candidate.id===value);
        return item&&item.icon?item.icon:svgIcon("物","#caa461");
    }

    function decorateSynthesis(){
        const root=document.querySelector(".v141-synthesis");
        if(!root){ return; }
        root.classList.add("v143-synthesis");
        root.querySelectorAll("label").forEach(label=>{
            const select=label.querySelector("select");
            if(!select||label.querySelector(".v143-item-picker")){ return; }
            if(/系列/.test(label.textContent)&&!/選擇裝備/.test(label.textContent)){ label.hidden=true; return; }
            const picker=document.createElement("div");
            picker.className="v143-item-picker";
            Array.from(select.options).forEach(option=>{
                const button=document.createElement("button");
                button.type="button";
                button.className=option.value===select.value?"selected":"";
                button.setAttribute("aria-label",option.textContent);
                button.innerHTML='<i>'+iconForPickerValue(option.value)+'</i><span>'+escapeHtml(option.textContent)+'</span>';
                button.onclick=()=>{
                    select.value=option.value;
                    select.dispatchEvent(new Event("change",{bubbles:true}));
                };
                picker.appendChild(button);
            });
            select.hidden=true;
            select.insertAdjacentElement("afterend",picker);
        });
        const series=root.querySelector(".v141-blueprint-series");
        if(series){ series.innerHTML="<span>2　合成結果</span><b>系統隨機普通裝備</b>"; }
        const preview=root.querySelector(".v141-craft-preview");
        if(preview){
            const icon=preview.querySelector(".v141-craft-icon");
            const text=preview.querySelector("div:last-child");
            if(icon){ icon.innerHTML=svgIcon("鍛","#d1ad69"); }
            if(text){ text.innerHTML="<b>隨機普通裝備</b><span>依圖紙部位與階級生成；不會產出赤炎、寒泉、岩岳、青嵐套裝。</span>"; }
        }
    }

    if(typeof MutationObserver!=="undefined"){
        const observer=new MutationObserver(()=>{
            if(document.querySelector(".v141-synthesis")&&!document.querySelector(".v141-synthesis.v143-synthesis")){
                requestAnimationFrame(decorateSynthesis);
            }
        });
        const startObserver=()=>observer.observe(document.body,{childList:true,subtree:true});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",startObserver,{once:true}); }
        else{ startObserver(); }
    }

    if(typeof window.v141RenderSynthesis==="function"){
        const previousRenderSynthesis=window.v141RenderSynthesis;
        window.v141RenderSynthesis=function(){
            const result=previousRenderSynthesis.apply(this,arguments);
            decorateSynthesis();
            return result;
        };
    }

    /* Shared lifecycle keeps the patched DOM healthy after page switches. */
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            if(page==="dungeon"){ setTimeout(fixDungeonNavigation,0); }
            if(page==="battle"){ setTimeout(()=>{ decorateEnemyCards(); syncEarthShieldEffects(); },0); }
            return result;
        };
    }
    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            decorateEnemyCards(); syncEarthShieldEffects();
            return result;
        };
    }

    function boot(){
        fixDungeonNavigation();
        decorateEnemyCards();
        syncEarthShieldEffects();
        decorateSynthesis();
    }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }
    else{ setTimeout(boot,0); }

    window.v143SystemDiagnostics=function(){
        return {
            version:VERSION,
            enemyCards:document.querySelectorAll(".v143-monster-identity").length,
            dungeonNavFixed:document.getElementById("v141DungeonNav")?.dataset.v143Fixed==="1",
            pendingPotion:!!window.v143PendingPotionTarget
        };
    };
})();
