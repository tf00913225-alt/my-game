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
        (content&&content.equipmentSetItems||[]).forEach(applySetRule);
        allOwnedItems().forEach(applySetRule);
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
        burn:"燃燒",freeze:"冰封",petrify:"石化",agilityDown:"敏捷降低",
        defenseDown:"防禦降低",statDown:"全屬性降低",damageDown:"傷害降低",
        stun:"暈眩・MISS提高"
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
        const stagger=current.targetIndexes.length>1?Math.min(210,position*55):0;
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
            popup.style.top=(rect.top+rect.height*.32)+"px";
            document.body.appendChild(popup);
            setTimeout(()=>popup.remove(),1250);
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

    /* ----- Main city: compact party identity and resource bars. ----- */
    function renderHomeRoster(){
        const page=document.getElementById("homePage");
        const grid=page&&page.querySelector(".home-card-grid");
        if(!page||!grid||typeof getExistingPartyIndexes!=="function"){ return; }
        let roster=document.getElementById("v146HomeRoster");
        if(!roster){
            roster=document.createElement("section");
            roster.id="v146HomeRoster";
            roster.className="v146-home-roster";
            grid.insertAdjacentElement("afterend",roster);
        }
        const cards=getExistingPartyIndexes().map(index=>{
            const character=getPartyCharacterByIndex(index);
            const stats=getPartyBattleStats(index);
            if(!character||!stats){ return ""; }
            const hp=Math.max(0,Math.min(numeric(stats.maxHP),numeric(character.hp)));
            const sp=Math.max(0,Math.min(numeric(stats.maxSP),numeric(character.sp)));
            const hpPercent=numeric(stats.maxHP)>0?hp/numeric(stats.maxHP)*100:0;
            const spPercent=numeric(stats.maxSP)>0?sp/numeric(stats.maxSP)*100:0;
            const artwork=typeof getCharacterArtworkPath==="function"?getCharacterArtworkPath(character):"";
            return '<article class="v146-home-character" data-element="'+escapeHtml(character.element||"fire")+'">'+
                '<img src="'+escapeHtml(artwork)+'" alt="'+escapeHtml(character.id||"角色")+'頭像">'+
                '<div class="v146-home-character-main"><div><b>'+escapeHtml(character.id||("角色"+(index+1)))+'</b><span>Lv.'+Math.max(1,Math.floor(numeric(character.level)||1))+'</span></div>'+
                '<div class="v146-home-resource hp"><i style="width:'+hpPercent+'%"></i><strong>HP '+Math.floor(hp)+' / '+Math.floor(numeric(stats.maxHP))+'</strong></div>'+
                '<div class="v146-home-resource sp"><i style="width:'+spPercent+'%"></i><strong>SP '+Math.floor(sp)+' / '+Math.floor(numeric(stats.maxSP))+'</strong></div></div></article>';
        }).join("");
        roster.innerHTML='<header><b>冒險隊伍</b><span>金幣 '+Math.floor(numeric(typeof gold!=="undefined"?gold:0)).toLocaleString("zh-TW")+'</span></header>'+cards;
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
            const cleaned=original.replace(/^(赤炎|寒泉|岩岳|青嵐)/,"");
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

    syncSetDefinitions();
    const boot=()=>{
        renderHomeRoster(); syncDungeonShell(); syncShopTotals(); polishSynthesis(); syncDefeatedCards();
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
