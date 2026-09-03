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
            /* HP damage owns the upper quarter of the card. Status text stays
               close to the card bottom so both remain independently readable. */
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
            /*
               The map's later walking wrapper must never rewrite a BOSS tap to
               a one-step ground coordinate. Let the source map handler use
               the original event so its portrait bounds open the dialogue.
            */
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

    function dungeonNavMarkup(abyssMapActive){
        const buttons=[
            ["角色","assets/ui/nav-character.png","openHomeFeature('character')"],
            ["背包","assets/ui/nav-backpack.png","openMapInventoryOverlay()"],
            ["商店","assets/ui/home-shop-v147.png","openHomeFeature('shop')"],
            ["元素匣","assets/ui/nav-element-box.png","openHomeFeature('autoBattleSettings')"]
        ];
        if(!abyssMapActive){ buttons.push(["返回","assets/ui/map-return.png","showPage('home')"]); }
        return buttons.map(button=>
            '<button class="nav-button nav-art-button-wrap" onclick="'+button[2]+'" aria-label="'+button[0]+'">'+
            '<img class="nav-art-button" src="'+button[1]+'" alt=""><span class="nav-sr-only">'+button[0]+'</span></button>'
        ).join("");
    }

    window.v146ExitAbyssMap=function(){
        if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
    };

    function syncDungeonShell(){
        const page=document.getElementById("dungeonPage");
        const app=document.getElementById("app");
        if(!page||!app){ return; }
        const active=page.classList.contains("active");
        const abyssMapActive=active&&!!page.querySelector(".v141-abyss-shell");
        page.classList.toggle("v146-abyss-active",abyssMapActive);
        page.classList.toggle("v146-abyss-intro-mode",active&&!!page.querySelector(".v141-abyss-intro"));
        let nav=document.getElementById("v141DungeonNav");
        if(active&&!nav){
            nav=document.createElement("div");
            nav.id="v141DungeonNav";
            nav.className="bottom-nav map-page-nav v141-dungeon-nav";
            app.appendChild(nav);
        }
        if(nav){
            const mode=abyssMapActive?"abyss-map":"dungeon";
            if(nav.dataset.v146Mode!==mode){
                nav.innerHTML=dungeonNavMarkup(abyssMapActive);
                nav.dataset.v146Mode=mode;
            }
            nav.dataset.v146Columns=abyssMapActive?"4":"5";
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

    /* ----- Main city: deduplicated HUD resources and complete party roster. ----- */
    function renderHomeRoster(){
        const page=document.getElementById("homePage");
        const grid=page&&page.querySelector(".home-card-grid");
        if(!page||!grid||typeof getExistingPartyIndexes!=="function"){ return; }
        const partyIndexes=getExistingPartyIndexes().slice(0,3);
        const hudGold=document.getElementById("homeHudGoldValue");
        const hudExp=document.getElementById("homeHudExpValue");
        syncHomeResourceValue(hudGold,typeof gold!=="undefined"?gold:0);
        syncHomeResourceValue(hudExp,typeof sharedExp!=="undefined"?sharedExp:0);
        let roster=document.getElementById("v146HomeRoster");
        if(!roster){
            roster=document.createElement("section");
            roster.id="v146HomeRoster";
            roster.className="v146-home-roster";
            roster.setAttribute("aria-label","冒險隊伍");
            grid.insertAdjacentElement("afterend",roster);
        }
        const cards=partyIndexes.map(index=>{
            const character=getPartyCharacterByIndex(index);
            const stats=getPartyBattleStats(index);
            if(!character||!stats){ return ""; }
            const hp=Math.max(0,Math.min(numeric(stats.maxHP),numeric(character.hp)));
            const sp=Math.max(0,Math.min(numeric(stats.maxSP),numeric(character.sp)));
            const hpPercent=numeric(stats.maxHP)>0?hp/numeric(stats.maxHP)*100:0;
            const spPercent=numeric(stats.maxSP)>0?sp/numeric(stats.maxSP)*100:0;
            const artwork=typeof getCharacterArtworkPath==="function"?getCharacterArtworkPath(character):"";
            return '<article class="v146-home-character" data-element="'+escapeHtml(character.element||"fire")+'">'+
                '<div class="v146-home-avatar"><img src="'+escapeHtml(artwork)+'" alt="'+escapeHtml(character.id||"角色")+'頭像"></div>'+
                '<div class="v146-home-character-main"><div><b>'+escapeHtml(character.id||("角色"+(index+1)))+'</b><span>Lv.'+Math.max(1,Math.floor(numeric(character.level)||1))+'</span></div>'+
                '<div class="v146-home-resource hp"><i style="width:'+hpPercent+'%"></i><strong>HP '+Math.floor(hp)+' / '+Math.floor(numeric(stats.maxHP))+'</strong></div>'+
                '<div class="v146-home-resource sp"><i style="width:'+spPercent+'%"></i><strong>SP '+Math.floor(sp)+' / '+Math.floor(numeric(stats.maxSP))+'</strong></div></div></article>';
        }).join("");
        roster.innerHTML='<header><b>冒險隊伍</b><span>隊伍 '+partyIndexes.length+' / 3</span></header>'+cards;
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

    function clearGrowthGuidanceDots(){
        document.querySelectorAll(".v146-growth-attention-target").forEach(target=>{
            setGrowthGuidanceDot(target,false,"");
        });
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
        return numeric(character.level)<maxLevel&&
            numeric(typeof sharedExp!=="undefined"?sharedExp:0)>=Math.max(1,numeric(character.expNext)||1);
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
            if(show){
                const label=type==="expPool"?"這名角色可以升級":type==="status"?"這名角色有能力點未分配":"這名角色有技能可處理";
                setGrowthGuidanceDot(target,true,label);
            }
        });
    }

    function guideExpPool(attention){
        guideCharacterAvatars(attention,"expPool");
        const container=document.getElementById("expDistributeList");
        if(!container){ return; }
        const indexes=typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes().slice(0,3):[];
        Array.from(container.querySelectorAll(".v131-exp-row")).forEach((row,position)=>{
            const index=indexes[position];
            if(index===undefined||!attention.byIndex[index]||!attention.byIndex[index].canLevel){ return; }
            const button=row.querySelector(".v131-exp-preview-btn");
            if(button&&!button.disabled){ setGrowthGuidanceDot(button,true,"點擊預覽升級"); }
        });
        const confirm=container.querySelector(".v131-exp-confirm");
        if(confirm&&!confirm.disabled){ setGrowthGuidanceDot(confirm,true,"確認本次升級"); }
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
        if(remaining>0){
            page.querySelectorAll("[onclick*='addPoint']").forEach(button=>{
                setGrowthGuidanceDot(button,true,"尚有能力點可分配");
            });
        }
        const confirm=document.getElementById("confirmStatusButton");
        if(confirm&&used>0&&!confirm.disabled){ setGrowthGuidanceDot(confirm,true,"確認能力配點"); }
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
            if(canSpend&&growthCard&&!growthCard.classList.contains("disabled")){
                setGrowthGuidanceDot(growthCard,true,level>0?"技能點足夠，可升級":"技能點足夠，可學習");
            }

            const equipCard=actionCards.find(card=>(card.getAttribute("onclick")||"").includes("equipSkill("));
            const canEquip=
                level>0&&
                EQUIPPABLE_SKILL_CATEGORIES.has(skill.category)&&
                !equipped.includes(skillId)&&
                equipped.length<4;
            if(canEquip&&equipCard&&!equipCard.classList.contains("disabled")){
                setGrowthGuidanceDot(equipCard,true,"已學習但尚未裝備");
                hasEquipReminder=true;
            }
        });

        if(hasEquipReminder){
            const emptySlot=Array.from(page.querySelectorAll("#skillLoadout .skill-loadout-slot"))
                .find(slot=>!slot.querySelector("[id^='loadoutIcon_']"));
            if(emptySlot){ setGrowthGuidanceDot(emptySlot,true,"這個技能欄位可以裝備技能"); }
        }
    }

    function syncCharacterAttentionDots(){
        const attention=getCharacterGrowthAttention();
        const homeButton=document.getElementById("homeIconCharacter")?.parentElement||null;
        setCharacterAttentionDot(homeButton,attention.show,attention.label);
        document.querySelectorAll("#mapPageNav button[aria-label='角色']").forEach(button=>{
            setCharacterAttentionDot(button,attention.show,attention.label);
        });
        clearLegacyHudExpAttention();

        clearGrowthGuidanceDots();
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
