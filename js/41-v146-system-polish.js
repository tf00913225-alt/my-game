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
    function applySetRule(item){
        return typeof window.v132NormalizeEquipmentSetItem==="function"
            ?window.v132NormalizeEquipmentSetItem(item):item;
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
            const actionCards=Array.from(row.querySelectorAll("button.skill-action-card"));
            const growthCard=actionCards.find(card=>card.dataset.skillAction==="growth");
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
                !!(canSpend&&growthCard&&!growthCard.disabled),
                level>0?"技能點足夠，可升級":"技能點足夠，可學習"
            );

            const equipCard=actionCards.find(card=>card.dataset.skillAction==="equip");
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
        document.querySelectorAll("#bottomNav button[aria-label='角色']").forEach(button=>{
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

    /* ----- Preserve legacy ordinary crafted equipment; blueprint metadata belongs to V132 materials. ----- */
    const SYNTHESIS_SET_PREFIX=/^(赤炎|寒泉|岩岳|青嵐)/;
    const SYNTHESIS_SET_COLORS=/#(?:e24b32|4bb9e8|c59a54|55cda3)/gi;

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
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            inventoryItems.forEach(normalizeOrdinaryCraftedItem);
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
        renderHomeRoster(); syncDungeonShell(); syncShopTotals(); syncDefeatedCards(); syncCharacterAttentionDots();
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
