/*
   V141 — mobile UI and battle presentation
   - 18-slot / 7-page backpack, compact dialogs and shop confirmation
   - battle card status effects, monster shield bar, entrance/exit transitions
   - black-gold post-battle reward summary
   - click-to-move patrol character + draggable quest tracker
   - daily dungeon cover structure, dungeon navigation and notification dots
*/
(function installV141UiAndBattle(){
    "use strict";

    const V141_RASTER_TICKET_IDS=new Set([
        "ticketSetFire",
        "ticketSetWater",
        "ticketSetEarth",
        "ticketSetWind"
    ]);
    const INVENTORY_PAGE_SIZE=18;
    const INVENTORY_PAGE_COUNT=7;
    const ANNOUNCEMENT_READ_KEY="v141_announcement_read";
    const QUEST_MILESTONE_KEY="v141_quest_milestones";
    const TASK_TRACKER_KEY="v141_task_tracker";
    let inventoryPageIndex=0;
    let battleSnapshot=null;
    let lastWildRankToken=null;
    let transitionRunning=false;
    let suppressLegacyExpToastUntil=0;

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function getCanonicalTicketIcon(item){
        if(!item || !V141_RASTER_TICKET_IDS.has(item.id)){ return ""; }
        const definition=typeof window.v132GetTicketDefinition==="function"
            ?window.v132GetTicketDefinition(item.id)
            :null;
        const icon=definition&&definition.id===item.id ? definition.icon : "";
        return (
            typeof icon==="string" &&
            icon.includes("v169-ticket-art")
        ) ? icon : "";
    }

    function getItemCounts(){
        const counts=new Map();
        inventoryItems.forEach(item=>{
            if(!item||!item.id){ return; }
            const current=counts.get(item.id)||{
                id:item.id,
                count:0,
                name:item.name||item.id
            };
            current.count+=Math.max(1,Number(item.count)||1);
            counts.set(item.id,current);
        });
        return counts;
    }

    /* =====================================================
       Backpack: 18 slots × 7 pages (the final page keeps the 120-slot cap)
    ===================================================== */
    function ensureInventoryPager(){
        const scroller=document.getElementById("inventoryGridScroll");
        if(!scroller||document.getElementById("v141InventoryPager")){ return; }
        const pager=document.createElement("div");
        pager.id="v141InventoryPager";
        pager.className="v141-inventory-pager";
        pager.innerHTML=
            '<button type="button" aria-label="上一頁" onclick="v141ChangeInventoryPage(-1)">←</button>'+
            '<span id="v141InventoryPageLabel">1 / 7</span>'+
            '<button type="button" aria-label="下一頁" onclick="v141ChangeInventoryPage(1)">→</button>';
        scroller.insertAdjacentElement("afterend",pager);
    }

    window.v141ChangeInventoryPage=function(direction){
        inventoryPageIndex=(inventoryPageIndex+Number(direction)+INVENTORY_PAGE_COUNT)%INVENTORY_PAGE_COUNT;
        renderInventoryItems();
    };

    if(typeof renderInventoryItems==="function"){
        renderInventoryItems=function(){
            rebuildInventorySlots();
            const grid=document.getElementById("inventoryGrid");
            if(!grid){ return; }
            ensureInventoryPager();
            grid.innerHTML="";

            const filtered=getFilteredInventoryItems();
            inventoryPageIndex=Math.max(0,Math.min(INVENTORY_PAGE_COUNT-1,inventoryPageIndex));
            const pageItems=filtered.slice(
                inventoryPageIndex*INVENTORY_PAGE_SIZE,
                (inventoryPageIndex+1)*INVENTORY_PAGE_SIZE
            );

            for(let index=0;index<INVENTORY_PAGE_SIZE;index++){
                const item=pageItems[index]||null;
                const box=document.createElement("div");
                box.className="inventory-item inventory-item-classic "+(item?"has-item":"empty");
                box.draggable=false;
                box.addEventListener("dragstart",event=>event.preventDefault());
                if(item){
                    box.innerHTML=
                        '<div class="inventory-icon">'+(item.icon||"◆")+'</div>'+
                        '<div class="inventory-count">'+((Number(item.count)||0)>1?"×"+item.count:"")+'</div>';
                    const realIndex=inventoryItems.indexOf(item);
                    box.onclick=()=>openItemModal(realIndex);
                    box.setAttribute("aria-label",item.name||"背包物品");
                }else{
                    box.innerHTML='<div class="inventory-empty-dot">·</div>';
                    box.setAttribute("aria-hidden","true");
                }
                grid.appendChild(box);
            }

            const label=document.getElementById("v141InventoryPageLabel");
            if(label){ label.textContent=(inventoryPageIndex+1)+" / "+INVENTORY_PAGE_COUNT; }
            document.querySelectorAll("#inventoryCategoryTabs [data-filter]").forEach(tab=>{
                const active=tab.dataset.filter===inventoryFilter;
                tab.classList.toggle("active",active);
                tab.setAttribute("aria-selected",active?"true":"false");
            });
        };
    }

    if(typeof setInventoryFilter==="function"){
        const originalSetInventoryFilter=setInventoryFilter;
        setInventoryFilter=function(){
            inventoryPageIndex=0;
            return originalSetInventoryFilter.apply(this,arguments);
        };
    }

    function getCreatedBackpackIndexes(){
        return [0,1,2].filter(index=>!!getBackpackCharacter(index));
    }

    if(typeof changeInventoryCharacter==="function"){
        changeInventoryCharacter=function(direction){
            const indexes=getCreatedBackpackIndexes();
            if(indexes.length===0){ return; }
            let position=indexes.indexOf(inventoryCharacterIndex);
            if(position<0){ position=0; }
            position=(position+(Number(direction)>=0?1:-1)+indexes.length)%indexes.length;
            inventoryCharacterIndex=indexes[position];
            renderInventory();
            if(typeof syncCharacterTabsFromInventory==="function"){
                syncCharacterTabsFromInventory(inventoryCharacterIndex);
            }
        };
    }

    if(typeof renderInventoryCharacterTabs==="function"){
        renderInventoryCharacterTabs=function(){
            const wrap=document.getElementById("inventoryCharacterTabs");
            if(!wrap){ return; }
            const indexes=getCreatedBackpackIndexes();
            if(indexes.length&& !indexes.includes(inventoryCharacterIndex)){ inventoryCharacterIndex=indexes[0]; }
            const character=getBackpackCharacter(inventoryCharacterIndex);
            wrap.innerHTML=
                '<button type="button" class="inventory-character-arrow" aria-label="上一個角色" onclick="changeInventoryCharacter(-1)">‹</button>'+
                '<div class="inventory-character-name"><span>'+escapeHtml(character&&character.id||"角色")+'</span>'+
                '<small class="inventory-character-level">'+(character?"Lv."+(character.level||1):"尚未建立")+'</small></div>'+
                '<button type="button" class="inventory-character-arrow" aria-label="下一個角色" onclick="changeInventoryCharacter(1)">›</button>';
        };
    }

    function getSelectedInventoryItem(){
        if(selectedInventorySlot===null||selectedInventorySlot===undefined){ return null; }
        return inventorySlots[selectedInventorySlot]||null;
    }

    function appendReforgeStatsToModal(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats||!item){ return; }
        if(item.reforgeStats&&Object.keys(item.reforgeStats).length){
            stats.insertAdjacentHTML(
                "beforeend",
                '<section class="v141-item-reforge"><b>【冶煉】</b>'+getStatText(item.reforgeStats)+'</section>'
            );
        }
    }

    function syncDecomposeButton(item,slotIndex){
        const buttons=document.querySelector("#itemModal .item-modal-buttons");
        if(!buttons){ return; }
        let button=document.getElementById("v141DecomposeButton");
        const canDecompose=!!(item&&item.setId&&isEquipmentInventoryType(item.type)&&Number.isInteger(slotIndex));
        if(!canDecompose){
            if(button){ button.remove(); }
            return;
        }
        if(!button){
            button=document.createElement("button");
            button.id="v141DecomposeButton";
            button.type="button";
            button.className="item-modal-button v141-decompose-button";
            buttons.appendChild(button);
        }
        button.textContent="分解成10碎片";
        button.onclick=()=>{
            if(typeof window.v141DecomposeSeriesItem==="function"){
                window.v141DecomposeSeriesItem(slotIndex);
            }
        };
    }

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            const item=inventorySlots[slotIndex];
            const icon=document.getElementById("itemModalIcon");
            if(icon&&item){ icon.innerHTML=item.icon||"◆"; }
            appendReforgeStatsToModal(item);
            syncDecomposeButton(item,slotIndex);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            const result=originalOpenEquippedItem.apply(this,arguments);
            const icon=document.getElementById("itemModalIcon");
            if(icon&&item){ icon.innerHTML=item.icon||"◆"; }
            appendReforgeStatsToModal(item);
            syncDecomposeButton(null,null);
            return result;
        };
    }

    document.addEventListener("dragstart",event=>{
        if(event.target&&event.target.closest&&event.target.closest("#inventoryPage,#itemModal")){
            event.preventDefault();
        }
    });

    /* =====================================================
       Additional characters can manually cast support skills
    ===================================================== */
    if(typeof prepareAction==="function"){
        const originalPrepareAction=prepareAction;
        prepareAction=function(type){
            const skill=skillDatabase[type];
            if(
                activeBattleCharacterIndex<=0 ||
                !skill ||
                !["buff","heal","revive"].includes(skill.category)
            ){
                return originalPrepareAction.apply(this,arguments);
            }
            const character=getPartyCharacterByIndex(activeBattleCharacterIndex);
            const autoOn=getPartyAutoConfig(activeBattleCharacterIndex).enabled;
            if(!battleActive||!character||character.hp<=0||autoOn||actionReady){ return; }
            const spCost=skill.spCost!==undefined?skill.spCost:skill.cost;
            if(character.sp<spCost){
                addBattleLog("SP不足，無法使用"+skill.name);
                return;
            }

            if(skill.targetType==="ally"||skill.targetType==="deadAlly"){
                const hasTarget=[0,1,2].some(index=>isValidAllyTargetForSkill(
                    skill,getBattleCharacterByIndex(index),index
                ));
                if(!hasTarget){
                    addBattleLog(skill.targetType==="deadAlly"?"目前沒有陣亡的隊友可供復活。":"目前沒有可選擇的友方目標。");
                    return;
                }
                actionReady=true;
                pendingAction=type;
                closeMenus();
                setBattleAllyTargetSelectionMode(type);
                return;
            }

            actionReady=true;
            queuedPlayerActions[activeBattleCharacterIndex]={action:type,target:null,targetAlly:null};
            closeMenus();
            updateUI();
            finishPlayerAction();
        };
    }

    /* =====================================================
       Card effects (persistent CSS layers + short Canvas particles)
    ===================================================== */
    function cardFor(side,index){
        return document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
    }

    function ensureEffectLayer(card){
        if(!card){ return null; }
        let layer=card.querySelector(":scope > .v141-card-effects");
        if(!layer){
            layer=document.createElement("div");
            layer.className="v141-card-effects";
            layer.setAttribute("aria-hidden","true");
            card.appendChild(layer);
        }
        return layer;
    }

    function activeEffectTypes(entity){
        const types=new Set();
        (entity&&entity.statusEffects||[]).forEach(effect=>{
            if(effect&&effect.type&&(effect.turnsLeft===undefined||effect.turnsLeft>0)){ types.add(effect.type); }
        });
        (entity&&entity.activeBuffs||[]).forEach(buff=>{
            if(!buff||!buff.type||buff.turnsLeft<=0){ return; }
            const map={
                shield:"shield",barrier:"barrier",earthShield:"barrier",rockWall:"buff",
                rage:"buff",phoenixMight:"buff",dodgeSkill:"buff",stealthSkill:"buff",dinghaishenzhen:"buff",
                v141TeamBuff:"buff"
            };
            if(map[buff.type]){ types.add(map[buff.type]); }
        });
        if(entity&&entity.v141Shield&&entity.v141Shield.remaining>0){
            types.add(entity.v141Shield.isBarrier?"barrier":"shield");
        }
        return [...types].filter(type=>[
            "burn","stun","freeze","petrify","shield","barrier","defenseDown",
            "agilityDown","damageDown","statDown","buff"
        ].includes(type));
    }

    function syncCardEffects(card,entity){
        const layer=ensureEffectLayer(card);
        if(!layer){ return; }
        const types=activeEffectTypes(entity);
        const signature=types.sort().join("|");
        if(layer.dataset.signature===signature){ return; }
        layer.dataset.signature=signature;
        layer.innerHTML=types.map(type=>'<span class="v141-effect v141-effect-'+type+'"></span>').join("");
    }

    function playCanvasParticles(card,type){
        if(!card||typeof requestAnimationFrame!=="function"){ return; }
        let canvas=card.querySelector(":scope > canvas.v141-effect-canvas");
        if(!canvas){
            canvas=document.createElement("canvas");
            canvas.className="v141-effect-canvas";
            canvas.setAttribute("aria-hidden","true");
            card.appendChild(canvas);
        }
        const rect=card.getBoundingClientRect();
        const width=Math.max(80,Math.round(rect.width||120));
        const height=Math.max(80,Math.round(rect.height||140));
        canvas.width=width*2;
        canvas.height=height*2;
        const context=canvas.getContext&&canvas.getContext("2d");
        if(!context){ return; }
        context.setTransform(2,0,0,2,0,0);
        const color={
            heal:"#75ff9d",revive:"#fff7a6",potion:"#62e9ff",talisman:"#ffd26a",
            shield:"#ffffff",barrier:"#ffd878",buff:"#8fffc1",debuff:"#c58cff"
        }[type]||"#ffffff";
        const particles=Array.from({length:18},(_,index)=>({
            x:width*(.2+Math.random()*.6),
            y:height*(.65+Math.random()*.25),
            vx:(Math.random()-.5)*1.2,
            vy:-(.7+Math.random()*1.7),
            r:1.5+Math.random()*3,
            delay:index*12
        }));
        const started=performance.now();
        canvas.classList.add("show");
        function frame(now){
            const elapsed=now-started;
            context.clearRect(0,0,width,height);
            particles.forEach(particle=>{
                const local=Math.max(0,elapsed-particle.delay);
                if(local<=0||local>650){ return; }
                const alpha=1-local/650;
                context.globalAlpha=alpha;
                context.fillStyle=color;
                context.shadowColor=color;
                context.shadowBlur=8;
                context.beginPath();
                context.arc(
                    particle.x+particle.vx*local/12,
                    particle.y+particle.vy*local/12,
                    particle.r*alpha+.5,0,Math.PI*2
                );
                context.fill();
            });
            context.globalAlpha=1;
            if(elapsed<760){ requestAnimationFrame(frame); }
            else{
                context.clearRect(0,0,width,height);
                canvas.classList.remove("show");
            }
        }
        requestAnimationFrame(frame);
    }

    window.v141PlayCardEffect=function(side,index,type){
        const card=cardFor(side,index);
        if(!card){ return; }
        const className="v141-once-"+type;
        card.classList.remove(className);
        void card.offsetWidth;
        card.classList.add(className);
        playCanvasParticles(card,type);
        setTimeout(()=>card.classList.remove(className),850);
    };

    function executeAdditionalSupportAction(characterIndex,queued,skill){
        const character=getPartyCharacterByIndex(characterIndex);
        const characterKey=getPartyCharacterKey(characterIndex);
        const casterStats=getPartyBattleStats(characterIndex);
        const level=Math.max(0,Number(getSkillLevel(characterKey,skill.id))||0);
        const cost=Number(skill.spCost!==undefined?skill.spCost:skill.cost)||0;
        const targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getBattleCharacterByIndex(targetIndex);

        function stop(message){
            if(message){ addBattleLog(message); }
            updateUI();
            finishPlayerAction();
            return true;
        }

        if(!character||!casterStats){ return stop("角色狀態無法讀取，本次行動已略過。"); }
        if(level<=0){ return stop((character.id||"角色")+"尚未學習"+skill.name+"。"); }
        if(character.sp<cost){ return stop((character.id||"角色")+"SP不足，無法使用"+skill.name+"。"); }
        if(skill.category==="heal"&&(!target||target.hp<=0)){ return stop(skill.name+"的目標無法接受治療。"); }
        if(skill.category==="revive"&&(!target||target.hp>0)){ return stop("目前選擇的目標不需要復活。"); }
        if(skill.category==="buff"&&skill.targetType==="ally"&&(!target||target.hp<=0)){
            return stop(skill.name+"的目標無法接受效果。");
        }

        character.sp-=cost;
        lungePlayerCard(characterIndex);
        showSkillNameBadge(skill.name,skill.element,characterIndex);
        setTimeout(()=>showPlayerSpPopup(cost,characterIndex),500);

        if(skill.category==="buff"){
            const targets=skill.targetType==="allyAll"
                ? getExistingPartyIndexes().map(getPartyCharacterByIndex).filter(item=>item&&item.hp>0)
                : [target||character];
            let extra={};
            if(skill.id==="rage"){
                const chance=(skill.critChanceBonusByLevel||skill.critBonusByLevel||[])[level-1]||0;
                const damage=(skill.critDamageBonusByLevel||skill.critBonusByLevel||[])[level-1]||0;
                extra={
                    bonusPercent:chance,
                    critChanceBonusPercent:chance,
                    critDamageBonusPercent:damage
                };
            }
            else if(skill.id==="dodgeSkill"){ extra={percent:skill.evasionBonusPercent}; }
            else if(skill.id==="rockWall"){ extra={percent:skill.defenseBonusPercent}; }
            else if(skill.id==="earthShield"){ extra={percent:skill.reflectPercent}; }
            else if(skill.id==="dinghaishenzhen"){ extra={resistBonus:skill.statusResistBonus}; }
            else if(skill.id==="barrier"){
                extra={
                    sourceSkill:"barrier",
                    barrierRule:"shared",
                    remainingBlocks:Number(skill.barrierBlockCount)||5
                };
            }
            targets.forEach(ally=>{
                ally.activeBuffs=(ally.activeBuffs||[]).filter(buff=>buff.type!==skill.id);
                ally.activeBuffs.push(Object.assign({type:skill.id,turnsLeft:skill.duration||2},extra));
                const actualIndex=getPartyCharacterIndex(ally);
                if(actualIndex>=0){ window.v141PlayCardEffect("player",actualIndex,/shield|barrier|護盾|結界/i.test(skill.id+skill.name)?"shield":"buff"); }
            });
            addBattleLog((character.id||"角色")+"施放"+skill.name+"，增益效果已套用。 ");
        }else if(skill.category==="heal"){
            const targetStats=getPartyBattleStats(targetIndex);
            const exId=skill.element+"EX";
            const exSkill=skillDatabase[exId];
            const exLevel=getSkillLevel(characterKey,exId);
            const multiplier=exSkill&&exLevel>0&&exSkill.healBonusPercent?1+exSkill.healBonusPercent/100:1;
            const baseHp=(Number(skill.baseHeal)||0)+(Number(skill.healPerLevel)||0)*(level-1);
            const plannedHp=Math.floor(calculateHealingAmount(baseHp,casterStats.intelligence)*multiplier);
            const actualHp=Math.max(0,Math.min(plannedHp,targetStats.maxHP-target.hp));
            const baseSp=(Number(skill.baseHealSP)||0)+(Number(skill.healSPPerLevel)||0)*(level-1);
            const plannedSp=target===character?0:Math.floor(calculateSPHealingAmount(baseSp,casterStats.intelligence)*multiplier);
            const actualSp=Math.max(0,Math.min(plannedSp,targetStats.maxSP-target.sp));
            target.hp=Math.min(targetStats.maxHP,target.hp+plannedHp);
            if(target!==character){ target.sp=Math.min(targetStats.maxSP,target.sp+plannedSp); }
            if(actualHp>0){ showPlayerHit(actualHp,"heal",targetIndex,true); }
            window.v141PlayCardEffect("player",targetIndex,"heal");
            addBattleLog(skill.name+"使"+(target.id||"隊友")+"恢復"+actualHp+" HP"+(target===character?"；施放者本人不回復SP。":"、"+actualSp+" SP。"));
        }else if(skill.category==="revive"){
            const targetStats=getPartyBattleStats(targetIndex);
            const exId=skill.element+"EX";
            const exSkill=skillDatabase[exId];
            const exLevel=getSkillLevel(characterKey,exId);
            const multiplier=exSkill&&exLevel>0&&exSkill.healBonusPercent?1+exSkill.healBonusPercent/100:1;
            const percent=(skill.reviveHealPercentByLevel||[20])[Math.min(level-1,(skill.reviveHealPercentByLevel||[20]).length-1)];
            target.hp=Math.max(1,Math.min(targetStats.maxHP,Math.floor(targetStats.maxHP*percent/100*multiplier)));
            setTimeout(()=>showPlayerHit(target.hp,"heal",targetIndex,true),300);
            window.v141PlayCardEffect("player",targetIndex,"revive");
            addBattleLog((target.id||"隊友")+"被"+skill.name+"復活，恢復"+target.hp+" HP。");
        }

        updateUI();
        finishPlayerAction();
        return true;
    }

    if(typeof updateMonsterUI==="function"){
        const originalUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            if(typeof window.v141SyncMonsterShield==="function"){
                window.v141SyncMonsterShield(monsters[index]);
            }
            const result=originalUpdateMonsterUI.apply(this,arguments);
            const monster=monsters[index];
            const card=cardFor("monster",index);
            syncCardEffects(card,monster);
            if(monster&&card){
                const normalBar=document.getElementById("battleMonsterBar"+index);
                const shieldBar=document.getElementById("battleMonsterShieldBar"+index);
                const hpText=document.getElementById("battleMonsterHPText"+index);
                const shield=monster.v141Shield;
                const remaining=shield?Math.max(0,Number(shield.remaining)||0):0;
                if(shield&&remaining>0){
                    const baseMax=shield.baseMaxHP;
                    const baseHp=Math.max(0,monster.hp-remaining);
                    const visibleShield=shield.isBarrier?baseMax:remaining;
                    const total=Math.max(1,baseMax+visibleShield);
                    if(normalBar){ normalBar.style.width=(baseHp/total*100)+"%"; }
                    if(shieldBar){
                        shieldBar.style.left=(baseHp/total*100)+"%";
                        shieldBar.style.width=(visibleShield/total*100)+"%";
                    }
                    if(hpText){
                        hpText.textContent=shield.isBarrier
                            ?Math.floor(baseHp)+"/"+baseMax+"　結界"
                            :Math.floor(baseHp)+"/"+baseMax+" +"+Math.floor(remaining);
                    }
                }else if(shieldBar){
                    shieldBar.style.left="0";
                    shieldBar.style.width="0";
                }
            }
            return result;
        };
    }

    if(typeof updateSingleCharacterStatusBadge==="function"){
        const originalUpdateSingleCharacterStatusBadge=updateSingleCharacterStatusBadge;
        updateSingleCharacterStatusBadge=function(index,character){
            const result=originalUpdateSingleCharacterStatusBadge.apply(this,arguments);
            syncCardEffects(cardFor("player",index),character);
            return result;
        };
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex]
                ? Object.assign({},queuedPlayerActions[characterIndex])
                : null;
            const skill=queued&&skillDatabase[queued.action];
            const talisman=queued&&window.v132GetTalismanDefinition
                ? window.v132GetTalismanDefinition(queued.action)
                : null;
            if(
                characterIndex>0&&queued&&skill&&
                ["buff","heal","revive"].includes(skill.category)
            ){
                return executeAdditionalSupportAction(characterIndex,queued,skill);
            }
            const result=originalResolveQueuedPlayerAction.apply(this,arguments);
            setTimeout(()=>{
                if(!queued){ return; }
                if(queued.action==="potion"){
                    window.v141PlayCardEffect("player",characterIndex,"potion");
                }else if(talisman){
                    const side=talisman.talismanEffect==="freeze"?"monster":"player";
                    const target=side==="monster"?queued.target:queued.targetAlly;
                    if(Number.isInteger(target)){ window.v141PlayCardEffect(side,target,"talisman"); }
                }else if(skill){
                    if(skill.category==="heal"&&Number.isInteger(queued.targetAlly)){
                        window.v141PlayCardEffect("player",queued.targetAlly,"heal");
                    }else if(skill.category==="revive"&&Number.isInteger(queued.targetAlly)){
                        window.v141PlayCardEffect("player",queued.targetAlly,"revive");
                    }else if(skill.category==="buff"){
                        const type=/shield|barrier|護盾|結界/i.test(skill.id+skill.name)?"shield":"buff";
                        if(skill.targetType==="allyAll"){
                            getExistingPartyIndexes().forEach(index=>window.v141PlayCardEffect("player",index,type));
                        }else if(Number.isInteger(queued.targetAlly)){
                            window.v141PlayCardEffect("player",queued.targetAlly,type);
                        }
                    }
                }
            },0);
            return result;
        };
    }

    /* =====================================================
       Dungeon element balancing and battle rendering
    ===================================================== */
    function rebalanceDungeonElements(){
        if(!window.v132ActiveDungeonRun){ return; }
        const roster=currentBattleMonsters.map(index=>monsters[index]).filter(Boolean);
        if(roster.some(monster=>monster.v141Abyss)){ return; }
        const elements=["fire","water","earth","wind"];
        for(let i=elements.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [elements[i],elements[j]]=[elements[j],elements[i]];
        }
        const bosses=roster.filter(monster=>getMonsterRank(monster)==="boss");
        bosses.forEach((monster,index)=>{ monster.element=elements[index%elements.length]; });
        let cursor=bosses.length;
        roster.filter(monster=>getMonsterRank(monster)!=="boss").forEach(monster=>{
            monster.element=elements[cursor++%elements.length];
        });
        roster.forEach(monster=>{
            const oldSkills=(monster.skillIds||[]).map(id=>skillDatabase[id]).filter(Boolean);
            const tier=Math.max(0,...oldSkills.map(skill=>Number(skill.tier)||0));
            const pool=Object.keys(skillDatabase).filter(id=>{
                const skill=skillDatabase[id];
                return skill&&skill.element===monster.element&&
                    (skill.category==="physical"||skill.category==="magic")&&
                    (!tier||skill.tier===tier);
            });
            if(typeof window.v141ConfigureMonsterSkills==="function"){
                window.v141ConfigureMonsterSkills(monster,{pool:pool});
            }
        });
    }

    function applyFixedAbyssFormation(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        const fixed=currentBattleMonsters
            .map(index=>({index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&Number.isInteger(entry.monster.v141FormationRow));
        if(!fixed.length){ return; }
        const cards=new Map(fixed.map(entry=>[entry.index,document.getElementById("battleMonster"+entry.index)]));
        area.innerHTML="";
        area.classList.add("v131-formation","v141-fixed-formation");
        [0,1].forEach(rowNumber=>{
            const row=document.createElement("div");
            row.className="v131-monster-row v131-monster-row-"+(rowNumber+1);
            fixed.filter(entry=>entry.monster.v141FormationRow===rowNumber)
                .sort((a,b)=>(a.monster.v141FormationPosition||0)-(b.monster.v141FormationPosition||0))
                .forEach(entry=>{
                    const card=cards.get(entry.index);
                    if(card){ row.appendChild(card); }
                });
            area.appendChild(row);
        });
    }
    window.v141ApplyFixedAbyssFormation=applyFixedAbyssFormation;

    function ensureMonsterShieldBars(){
        currentBattleMonsters.forEach(index=>{
            const hp=document.querySelector("#battleMonster"+index+" .monster-hp");
            if(!hp||document.getElementById("battleMonsterShieldBar"+index)){ return; }
            const bar=document.createElement("div");
            bar.id="battleMonsterShieldBar"+index;
            bar.className="v141-monster-shield-bar";
            const text=document.getElementById("battleMonsterHPText"+index);
            hp.insertBefore(bar,text||null);
        });
    }

    function decorateBattleCards(){
        ensureMonsterShieldBars();
        currentBattleMonsters.forEach(index=>{
            const card=cardFor("monster",index);
            const monster=monsters[index];
            if(card&&monster){
                card.dataset.element=monster.element||"unknown";
                card.dataset.rank=getMonsterRank(monster);
                syncCardEffects(card,monster);
                updateMonsterUI(index);
            }
        });
        getExistingPartyIndexes().forEach(index=>{
            syncCardEffects(cardFor("player",index),getPartyCharacterByIndex(index));
        });
        applyFixedAbyssFormation();
    }

    if(typeof renderBattle==="function"){
        const originalRenderBattle=renderBattle;
        renderBattle=function(){
            const isDungeon=!!window.v132ActiveDungeonRun;
            if(!isDungeon && lastWildRankToken!==battleToken){
                lastWildRankToken=battleToken;
                if(typeof window.v141RollWildMonsterRanks==="function"){
                    window.v141RollWildMonsterRanks(currentBattleMonsters);
                }
            }
            if(isDungeon){ rebalanceDungeonElements(); }

            battleSnapshot={
                token:battleToken,
                gold:Math.max(0,Number(gold)||0),
                exp:Math.max(0,Number(sharedExp)||0),
                items:getItemCounts(),
                dungeon:isDungeon
            };
            const result=originalRenderBattle.apply(this,arguments);
            decorateBattleCards();
            const page=document.getElementById("battlePage");
            if(page){
                page.classList.remove("v141-entry-moving","v141-exit-player","v141-exit-monster");
                page.classList.add("v141-preparing-entry");
            }
            return result;
        };
    }

    /* =====================================================
       Battle transitions and post-battle reward timing
    ===================================================== */
    function ensureBattleTransitionOverlay(){
        const page=document.getElementById("battlePage");
        if(!page){ return null; }
        let overlay=document.getElementById("v141BattleTransition");
        if(!overlay){
            overlay=document.createElement("div");
            overlay.id="v141BattleTransition";
            overlay.className="v141-battle-transition";
            overlay.innerHTML='<span></span><b>戰</b><span></span>';
            page.appendChild(overlay);
        }
        return overlay;
    }

    const startedEntryTokens=new Set();
    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            if(!battleActive||startedEntryTokens.has(token)){
                return originalStartTurn.apply(this,arguments);
            }
            startedEntryTokens.add(token);
            const overlay=ensureBattleTransitionOverlay();
            const page=document.getElementById("battlePage");
            transitionRunning=true;
            if(overlay){ overlay.classList.add("show"); }
            setTimeout(()=>{
                if(overlay){ overlay.classList.remove("show"); }
                if(page){
                    page.classList.remove("v141-preparing-entry");
                    page.classList.add("v141-entry-moving");
                }
                setTimeout(()=>{
                    if(page){ page.classList.remove("v141-entry-moving"); }
                    transitionRunning=false;
                    if(battleActive&&token===battleToken){ originalStartTurn.call(this,token); }
                },720);
            },1000);
        };
    }

    function collectRewardSummary(){
        const snapshot=battleSnapshot;
        if(!snapshot){ return {exp:0,gold:0,items:[]}; }
        const nowItems=getItemCounts();
        const items=[];
        nowItems.forEach((entry,id)=>{
            const before=snapshot.items.get(id);
            const delta=entry.count-(before?before.count:0);
            if(delta>0){
                items.push({
                    id,
                    name:entry.name,
                    count:delta
                });
            }
        });
        return {
            exp:Math.max(0,Math.floor((Number(sharedExp)||0)-snapshot.exp)),
            gold:Math.max(0,Math.floor((Number(gold)||0)-snapshot.gold)),
            items:items
        };
    }

    function showBlackGoldReward(summary){
        let toast=document.getElementById("v141RewardToast");
        if(!toast){
            toast=document.createElement("div");
            toast.id="v141RewardToast";
            toast.className="v141-reward-toast";
            document.body.appendChild(toast);
        }
        const parts=[];
        if(summary.exp>0){ parts.push('<span><b>EXP</b> +'+summary.exp.toLocaleString("zh-TW")+'</span>'); }
        if(summary.gold>0){ parts.push('<span><b>金幣</b> +'+summary.gold.toLocaleString("zh-TW")+'</span>'); }
        summary.items.forEach(item=>{
            const canonicalIcon=getCanonicalTicketIcon(item);
            const icon=canonicalIcon
                ? '<i class="v141-reward-item-icon" aria-hidden="true">'+canonicalIcon+'</i>'
                : "";
            parts.push(
                '<span class="v141-reward-item">'+icon+
                '<span><b>物品</b> '+escapeHtml(item.name)+' ×'+item.count+'</span></span>'
            );
        });
        if(!parts.length){ return; }
        toast.innerHTML='<strong>戰鬥獎勵</strong><div>'+parts.join("")+'</div>';
        toast.classList.remove("show");
        void toast.offsetWidth;
        toast.classList.add("show");
        clearTimeout(toast._hideTimer);
        toast._hideTimer=setTimeout(()=>toast.classList.remove("show"),4200);
    }
    window.v141ShowBlackGoldReward=showBlackGoldReward;

    if(typeof showExpToast==="function"){
        showExpToast=function(amount){
            if(Date.now()<suppressLegacyExpToastUntil){ return; }
            showBlackGoldReward({exp:Math.max(0,Math.floor(Number(amount)||0)),gold:0,items:[]});
        };
    }

    function finishBattleExit(kind,original,args,context){
        if(transitionRunning){ return; }
        transitionRunning=true;
        const wasDungeon=!!window.v132ActiveDungeonRun;
        const page=document.getElementById("battlePage");
        const overlay=ensureBattleTransitionOverlay();
        /* Keep the final hit / death pose readable before cards leave and the
           opaque result seal arrives.  This is deliberately longer than the
           card-hit animation and is still owned by the battle exit lifecycle. */
        setTimeout(()=>{
            if(page){ page.classList.add(kind==="win"?"v141-exit-player":"v141-exit-monster"); }
        },720);
        setTimeout(()=>{
            if(overlay){
                const label=overlay.querySelector("b");
                if(label){ label.textContent=kind==="win"?"勝利":"戰鬥失敗"; }
                overlay.dataset.v144Kind=kind==="win"?"win":"lose";
                overlay.classList.add("show");
            }
        },1450);
        setTimeout(()=>{
            /* 舊 winBattle 會再延遲呼叫一次 showExpToast；必須在進入舊
               結算前先抑制，否則會先跳單獨 EXP，再跳本層整合獎勵。 */
            if(kind==="win"){ suppressLegacyExpToastUntil=Date.now()+5000; }
            const result=original.apply(context,args);
            const summary=collectRewardSummary();
            if(page){ page.classList.remove("v141-exit-player","v141-exit-monster","v141-preparing-entry","v141-entry-moving"); }
            if(overlay){ overlay.classList.remove("show"); }
            transitionRunning=false;

            if(!wasDungeon){
                showPage("map");
                if(typeof startMonsterMovement==="function"){ startMonsterMovement(); }
                if(typeof scheduleAutoPatrolCheck==="function"){ scheduleAutoPatrolCheck(5000); }
                if(typeof updateUI==="function"){ updateUI(); }
                if(kind==="win"){ setTimeout(()=>showBlackGoldReward(summary),120); }
            }
            return result;
        },2700);
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        let exitingWin=false;
        winBattle=function(){
            if(!battleActive||exitingWin){ return; }
            exitingWin=true;
            const args=arguments;
            const context=this;
            finishBattleExit("win",function(){
                try{ return originalWinBattle.apply(context,args); }
                finally{ exitingWin=false; }
            },[],this);
        };
    }

    if(typeof loseBattle==="function"){
        const originalLoseBattle=loseBattle;
        let exitingLoss=false;
        loseBattle=function(){
            if(!battleActive||exitingLoss){ return; }
            exitingLoss=true;
            const args=arguments;
            const context=this;
            finishBattleExit("lose",function(){
                try{ return originalLoseBattle.apply(context,args); }
                finally{ exitingLoss=false; }
            },[],this);
        };
    }

    if(typeof window.v132ShowRewardModal==="function"){
        const originalShowRewardModal=window.v132ShowRewardModal;
        window.v132ShowRewardModal=function(innerHtml){
            const battlePage=document.getElementById("battlePage");
            const leavingBattle=battlePage&&battlePage.classList.contains("active");
            if(leavingBattle){
                showPage("dungeon");
                switchDungeonTab("daily");
                setTimeout(()=>originalShowRewardModal.call(this,innerHtml),180);
                return;
            }
            return originalShowRewardModal.apply(this,arguments);
        };
    }

    /* =====================================================
       Patrol click movement and task tracker
    ===================================================== */
    function installPatrolClickMovement(){
        const page=document.getElementById("mapPage");
        if(!page||page.dataset.v141MoveReady==="1"){ return; }
        page.dataset.v141MoveReady="1";
        page.addEventListener("click",function(event){
            if(battleActive||patrolInFightAnimation||event.defaultPrevented){ return; }
            if(event.target.closest("button,#v141TaskTracker,[id^='mapMonster'],#v131PatrolAppearanceSwitchWrap,#mapBattleOverlay")){ return; }
            const wrap=document.getElementById("patrolCharacterWrap");
            if(!wrap){ return; }
            const rect=page.getBoundingClientRect();
            if(!rect.width||!rect.height){ return; }
            const x=Math.max(.12,Math.min(.88,(event.clientX-rect.left)/rect.width));
            const overlay=document.getElementById("mapBattleOverlay");
            const overlayRect=overlay&&overlay.style.display!=="none"?overlay.getBoundingClientRect():null;
            const bottomClient=overlayRect&&overlayRect.top>rect.top?overlayRect.top-12:rect.top+rect.height*.62;
            const y=Math.max(.16,Math.min((bottomClient-rect.top)/rect.height,(event.clientY-rect.top)/rect.height));
            const oldX=parseFloat(wrap.style.left)||50;
            const oldY=parseFloat(wrap.style.top)||37;
            const newX=x*100;
            const newY=y*100;
            const distance=Math.hypot((newX-oldX)*rect.width/100,(newY-oldY)*rect.height/100);
            const duration=Math.max(.45,Math.min(2.6,distance/125));

            if(patrolWalkIntervalId){ clearInterval(patrolWalkIntervalId); patrolWalkIntervalId=null; }
            wrap.style.transition="left "+duration+"s cubic-bezier(.22,.61,.36,1),top "+duration+"s cubic-bezier(.22,.61,.36,1)";
            wrap.style.left=newX+"%";
            wrap.style.top=newY+"%";
            patrolCurrentTop=newY;
            const img=document.getElementById("patrolCharacterImg");
            if(img){ img.classList.add("v141-manual-walking"); }
            if(typeof window.v131ApplyPatrolArt==="function"){
                window.v131ApplyPatrolArt(newY<oldY);
            }
            setTimeout(()=>{
                if(img){ img.classList.remove("v141-manual-walking"); }
                if(typeof window.v131ApplyPatrolArt==="function"){ window.v131ApplyPatrolArt(false); }
                if(autoPatrolEnabled&&!battleActive){ startPatrolCharacterWalking(); }
            },duration*1000+40);
        });
    }

    function loadTaskTrackerState(){
        try{
            const value=JSON.parse(localStorage.getItem(TASK_TRACKER_KEY)||"{}");
            return {top:Number(value.top)||18,collapsed:!!value.collapsed};
        }catch(_){ return {top:18,collapsed:false}; }
    }
    const taskTrackerState=loadTaskTrackerState();
    function persistTaskTracker(){
        try{ localStorage.setItem(TASK_TRACKER_KEY,JSON.stringify(taskTrackerState)); }catch(_){ }
    }

    function getTrackerQuest(definitions,state){
        return definitions.find(quest=>!state.claimed[quest.id]&&(Number(state.progress[quest.id])||0)<quest.goal)||
            definitions.find(quest=>!state.claimed[quest.id])||null;
    }

    function renderTaskTracker(){
        const tracker=document.getElementById("v141TaskTracker");
        if(!tracker){ return; }
        ensureDailyQuestsCurrent();
        tracker.classList.toggle("collapsed",taskTrackerState.collapsed);
        const body=tracker.querySelector(".v141-task-tracker-body");
        if(!body){ return; }
        const daily=getTrackerQuest(dailyQuestDefinitions,dailyQuestState);
        const commission=getTrackerQuest(commissionQuestDefinitions,commissionQuestState);
        const rows=[["每日",daily,dailyQuestState],["委託",commission,commissionQuestState]]
            .filter(entry=>entry[1])
            .map(([label,quest,state])=>{
                const progress=Math.min(quest.goal,Number(state.progress[quest.id])||0);
                return '<div><b>'+label+'</b><span>'+escapeHtml(quest.name)+'</span><em>'+progress+'/'+quest.goal+'</em></div>';
            }).join("");
        if(body.dataset.rows!==rows){ body.dataset.rows=rows; body.innerHTML=rows||'<div><span>今日任務已完成</span></div>'; }
    }

    function clampTaskTracker(){
        const page=document.getElementById("mapPage");
        const tracker=document.getElementById("v141TaskTracker");
        if(!page||!tracker){ return; }
        const maxTop=Math.max(72,page.clientHeight-70-(document.getElementById("mapBattleOverlay")?.offsetHeight||102)-tracker.offsetHeight-8);
        taskTrackerState.top=Math.max(72,Math.min(maxTop,taskTrackerState.top));
        tracker.style.top=taskTrackerState.top+"px";
    }

    function installTaskTracker(){
        const page=document.getElementById("mapPage");
        if(!page||document.getElementById("v141TaskTracker")){ return; }
        const tracker=document.createElement("aside");
        tracker.id="v141TaskTracker";
        tracker.className="v141-task-tracker";
        tracker.innerHTML=
            '<button type="button" class="v141-task-collapse" aria-label="隱藏或展開任務">‹</button>'+
            '<div class="v141-task-tracker-title">任務追蹤</div>'+
            '<div class="v141-task-tracker-body"></div>';
        page.appendChild(tracker);
        const collapse=tracker.querySelector(".v141-task-collapse");
        collapse.addEventListener("click",event=>{
            event.stopPropagation();
            taskTrackerState.collapsed=!taskTrackerState.collapsed;
            persistTaskTracker();
            renderTaskTracker();
        });

        let drag=null;
        tracker.addEventListener("pointerdown",event=>{
            if(event.target===collapse){ return; }
            drag={id:event.pointerId,startY:event.clientY,startTop:taskTrackerState.top};
            try{ tracker.setPointerCapture(event.pointerId); }catch(_){ }
            event.preventDefault();
        });
        tracker.addEventListener("pointermove",event=>{
            if(!drag||drag.id!==event.pointerId){ return; }
            const pageRect=page.getBoundingClientRect();
            const scale=pageRect.height?page.clientHeight/pageRect.height:1;
            taskTrackerState.top=drag.startTop+(event.clientY-drag.startY)*scale;
            clampTaskTracker();
            event.preventDefault();
        });
        function finish(event){
            if(!drag||drag.id!==event.pointerId){ return; }
            drag=null;
            persistTaskTracker();
            event.preventDefault();
        }
        tracker.addEventListener("pointerup",finish);
        tracker.addEventListener("pointercancel",finish);
        renderTaskTracker();
        requestAnimationFrame(clampTaskTracker);
    }

    /* =====================================================
       Quest milestone chests
    ===================================================== */
    function today(){ return new Date().toISOString().slice(0,10); }
    function loadMilestones(){
        try{
            const state=JSON.parse(localStorage.getItem(QUEST_MILESTONE_KEY)||"{}");
            if(state.date===today()){
                return {date:state.date,daily:state.daily||{},commission:state.commission||{}};
            }
        }catch(_){ }
        return {date:today(),daily:{},commission:{}};
    }
    let milestoneState=loadMilestones();
    const milestoneRewards={
        daily:{20:{gold:20},40:{gold:30,exp:20},60:{gold:40},80:{gold:50,exp:30},100:{gold:80,exp:50}},
        commission:{20:{gold:50},40:{gold:75,exp:30},60:{gold:100},80:{gold:150,exp:70},100:{gold:250,exp:120}}
    };
    function persistMilestones(){
        try{ localStorage.setItem(QUEST_MILESTONE_KEY,JSON.stringify(milestoneState)); }catch(_){ }
    }
    function rewardLabel(reward){
        return [reward.gold?reward.gold+"金":null,reward.exp?reward.exp+"EXP":null].filter(Boolean).join("＋");
    }

    if(typeof renderQuestCompletionPanelContent==="function"){
        renderQuestCompletionPanelContent=function(definitions,state){
            if(milestoneState.date!==today()){ milestoneState={date:today(),daily:{},commission:{}}; persistMilestones(); }
            const type=definitions===commissionQuestDefinitions?"commission":"daily";
            const percent=getQuestCompletionPercent(definitions,state);
            const display=Math.floor(percent);
            const milestones=QUEST_COMPLETION_MILESTONES.map(threshold=>{
                const reached=percent>=threshold;
                const claimed=!!milestoneState[type][threshold];
                const reward=milestoneRewards[type][threshold];
                return '<div class="quest-milestone '+(reached?"reached ":"")+(claimed?"claimed":"")+'">'+
                    '<div class="quest-milestone-percent">'+threshold+'%</div>'+
                    '<button type="button" class="quest-milestone-slot" '+(!reached||claimed?"disabled":"")+
                    ' onclick="v141ClaimQuestMilestone(\''+type+'\','+threshold+')">'+
                    '<span>'+(claimed?"已領":reached?"領取":"寶箱")+'</span><small>'+rewardLabel(reward)+'</small></button></div>';
            }).join("");
            return '<div class="quest-completion-head"><span>完成度寶箱</span><strong>'+display+'%</strong></div>'+
                '<div class="quest-completion-track" aria-hidden="true"><div class="quest-completion-fill" style="width:'+percent+'%;"></div></div>'+
                '<div class="quest-completion-milestones">'+milestones+'</div>';
        };
    }

    window.v141ClaimQuestMilestone=function(type,threshold){
        const definitions=type==="commission"?commissionQuestDefinitions:dailyQuestDefinitions;
        const state=type==="commission"?commissionQuestState:dailyQuestState;
        if(!milestoneRewards[type]||!milestoneRewards[type][threshold]){ return; }
        if(getQuestCompletionPercent(definitions,state)<threshold||milestoneState[type][threshold]){ return; }
        const reward=milestoneRewards[type][threshold];
        gold+=reward.gold||0;
        sharedExp+=reward.exp||0;
        milestoneState[type][threshold]=true;
        persistMilestones();
        updateGoldDisplay();
        updateUI();
        saveGame();
        switchQuestTab(type==="commission"?"commission":"daily");
    };

    /* =====================================================
       Compact offline EXP, shop, element box and skill preview
    ===================================================== */
    if(typeof renderOfflineExpContent==="function"){
        renderOfflineExpContent=function(){
            const multiplier=typeof window.v141GetOfflineLevelMultiplier==="function"
                ? window.v141GetOfflineLevelMultiplier():1;
            const rested=typeof window.v139GetRestedExpState==="function"
                ? window.v139GetRestedExpState():{battles:0,maxBattles:300};
            return '<div class="v141-offline-panel">'+
                '<section><small>依帳號最高角色 Lv.'+(window.v141GetHighestCharacterLevel?window.v141GetHighestCharacterLevel():1)+'</small>'+
                '<strong>'+Math.floor(pendingOfflineExp).toLocaleString("zh-TW")+' EXP</strong>'+
                '<span>離線倍率 ×'+multiplier.toFixed(1)+'・上限 '+OFFLINE_EXP_MAX_MINUTES+' 分鐘</span></section>'+
                '<div class="v141-offline-actions">'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="claimOfflineExp(false)">直接領取</button>'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="watchOfflineExpAd()">廣告雙倍</button></div>'+
                '<section class="rested"><small>休息經驗</small><strong>'+rested.battles+' / '+rested.maxBattles+' 場</strong>'+
                '<span>一般練功 EXP ×2；元素匣與副本不消耗</span></section></div>';
        };
    }

    if(typeof renderShopContent==="function"){
        const originalRenderShopContent=renderShopContent;
        renderShopContent=function(){
            return '<div class="v141-shop-wallet">目前金幣 <b>'+Math.floor(gold).toLocaleString("zh-TW")+'</b></div>'+
                originalRenderShopContent.apply(this,arguments);
        };
    }

    if(typeof buyShopItem==="function"){
        const originalBuyShopItem=buyShopItem;
        buyShopItem=async function(itemId,requestedQuantity){
            const item=getPotionDefinition(itemId);
            const quantity=Math.max(1,Math.min(9999,Math.floor(Number(requestedQuantity)||1)));
            if(!item){ return; }
            const total=(Number(item.price)||0)*quantity;
            if(
                typeof window.rpgConfirm!=="function" ||
                !await window.rpgConfirm(
                    "確認購買「"+item.name+"」×"+quantity+"？\n將消耗 "+total.toLocaleString("zh-TW")+" 金幣。",
                    {
                        title:"商店購買",
                        confirmText:"確定購買",
                        cancelText:"返回"
                    }
                )
            ){
                return;
            }
            return originalBuyShopItem.apply(this,arguments);
        };
    }

    function compactElementBoxPanel(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        const stats=document.getElementById("v131ElementBoxStats");
        if(!panel||!stats){ return; }
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        const totalMinutes=Math.floor(state.remainingMs/60000);
        const text=Math.floor(totalMinutes/60)+"小時 "+(totalMinutes%60)+"分鐘";
        stats.innerHTML=
            '<div class="v141-element-box-remaining"><span>元素匣剩餘時間</span><strong id="v131EbRemaining">'+text+'</strong></div>'+
            '<button type="button" class="v141-element-box-ad" onclick="v141WatchElementBoxAd()">觀看廣告 ＋8小時</button>'+
            '<small>最多可累積32小時，可隨時增加。</small>';
        panel.classList.add("v141-compact-element-box");
    }

    window.v141WatchElementBoxAd=function(){
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        if(state.remainingMs>=32*60*60*1000){ alert("元素匣已達32小時上限。"); return; }
        showRewardedAd(()=>{
            if(window.v131GrantElementBoxHours){ window.v131GrantElementBoxHours(8,32); }
            compactElementBoxPanel();
            addBattleLog("元素匣增加8小時，最多累積32小時。");
        },()=>alert("廣告未完成，未增加元素匣時數。"));
    };

    if(typeof openAllElementSkillPreview==="function"){
        const originalOpenAllElementSkillPreview=openAllElementSkillPreview;
        openAllElementSkillPreview=function(){
            const modal=document.getElementById("allElementSkillPreviewModal");
            if(modal&&modal.parentElement!==document.body){ document.body.appendChild(modal); }
            if(modal){ modal.classList.add("v141-body-preview"); }
            return originalOpenAllElementSkillPreview.apply(this,arguments);
        };
    }

    /* =====================================================
       Daily dungeon covers and dungeon navigation
    ===================================================== */
    const dungeonCoverData={
        exp:{title:"經驗副本",requirement:"單一角色達到10級",reward:"當前升級需求平均值的11% EXP",action:"v132BeginExpDungeon"},
        material:{title:"材料副本",requirement:"至少兩名角色達到20級",reward:"材料寶箱 ×1～3",action:"v132BeginMaterialDungeon"},
        equipment:{title:"裝備副本",requirement:"至少兩名角色達到20級",reward:"自選系列裝備抽獎券",action:"v132BeginEquipmentDungeon"}
    };

    function renderDungeonCoverCard(type){
        const data=dungeonCoverData[type];
        const available=!window.v132IsDungeonAvailable||window.v132IsDungeonAvailable(type);
        return '<article class="v141-dungeon-cover-card" data-dungeon-cover="'+type+'">'+
            '<div class="v141-dungeon-cover-art"><span>'+data.title+'</span><small>封面圖預留區</small></div>'+
            '<div class="v141-dungeon-cover-info"><b>'+data.title+'</b><span>開放：'+data.requirement+'</span></div>'+
            '<div class="v141-dungeon-cover-actions">'+
            '<button type="button" onclick="v141ShowDungeonRewardPreview(\''+type+'\')">獎勵預覽</button>'+
            '<button type="button" '+(available?'onclick="'+data.action+'()"':'disabled')+'>挑戰</button></div>'+
            '<div class="v141-dungeon-remaining">剩餘次數：'+(available?'1':'0')+' / 1</div></article>';
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return '<div class="v141-dungeon-cover-list">'+Object.keys(dungeonCoverData).map(renderDungeonCoverCard).join("")+'</div>';
            }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }

    window.v141ShowDungeonRewardPreview=function(type){
        const data=dungeonCoverData[type];
        if(!data){ return; }
        const html='<div class="v132-reward-modal-inner"><h3>'+data.title+'獎勵預覽</h3><p>'+data.reward+'</p>'+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        if(window.v132ShowRewardModal){ window.v132ShowRewardModal(html); }
    };

    function installDungeonNavigation(){
        if(document.getElementById("v141DungeonNav")){ return; }
        const nav=document.createElement("div");
        nav.id="v141DungeonNav";
        nav.className="bottom-nav map-page-nav v141-dungeon-nav";
        nav.innerHTML=
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'character\')" aria-label="角色"><img class="nav-art-button" src="assets/ui/nav-character.png" alt=""><span class="nav-sr-only">角色</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openMapInventoryOverlay()" aria-label="背包"><img class="nav-art-button" src="assets/ui/nav-backpack.png" alt=""><span class="nav-sr-only">背包</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'quest\')" aria-label="任務"><img class="nav-art-button" src="assets/ui/nav-quest.png" alt=""><span class="nav-sr-only">任務</span></button>'+
            '<button class="nav-button nav-art-button-wrap" onclick="openHomeFeature(\'autoBattleSettings\')" aria-label="元素匣／自動戰鬥設定"><img class="nav-art-button" src="assets/ui/nav-element-box.png" alt=""><span class="nav-sr-only">元素匣／自動戰鬥設定</span></button>';
        document.getElementById("app").appendChild(nav);

        const page=document.getElementById("dungeonPage");
        if(page&&!document.getElementById("v141DungeonReturn")){
            const back=document.createElement("button");
            back.id="v141DungeonReturn";
            back.className="map-page-return-float v141-dungeon-return";
            back.setAttribute("aria-label","返回主城");
            back.innerHTML='<img src="assets/ui/map-return.png" alt="">';
            back.onclick=()=>showPage("home");
            page.appendChild(back);
        }
    }

    /* =====================================================
       Notification dots
    ===================================================== */
    function setNotificationDot(target,show,label){
        if(!target){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot");
        if(show&&!dot){
            dot=document.createElement("span");
            dot.className="v141-notice-dot";
            dot.setAttribute("aria-label",label||"有新內容");
            target.appendChild(dot);
        }else if(!show&&dot){ dot.remove(); }
    }

    function updateNotificationDots(){
        if(typeof ensureDailyQuestsCurrent==="function"){ ensureDailyQuestsCurrent(); }
        const hasQuestNotice=[
            ...dailyQuestDefinitions.map(quest=>[quest,dailyQuestState]),
            ...commissionQuestDefinitions.map(quest=>[quest,commissionQuestState])
        ].some(([quest,state])=>!state.claimed[quest.id]);
        const hasAchievement=achievementDefinitions.some(item=>item.check()&&!achievementState[item.id]);
        const announcementUnread=localStorage.getItem(ANNOUNCEMENT_READ_KEY)!=="1";
        setNotificationDot(document.getElementById("homeIconQuest")?.parentElement,hasQuestNotice,"任務有新進度");
        setNotificationDot(document.getElementById("homeIconAchievement")?.parentElement,hasAchievement,"成就可領取");
        setNotificationDot(document.getElementById("homeIconOfflineExp")?.parentElement,pendingOfflineExp>0,"有離線經驗可領取");
        setNotificationDot(document.getElementById("homeIconAnnouncement")?.parentElement,announcementUnread,"公告未讀");
        const dungeonPending=["exp","material","equipment"].some(type=>
            !window.v132IsDungeonUsedToday||!window.v132IsDungeonUsedToday(type)
        );
        setNotificationDot(document.getElementById("dungeonNav"),dungeonPending,"副本尚未完成");
        document.querySelectorAll("#mapPageNav button[aria-label='任務'],#v141DungeonNav button[aria-label='任務']")
            .forEach(button=>setNotificationDot(button,hasQuestNotice,"任務有新進度"));
    }
    window.v141UpdateNotificationDots=updateNotificationDots;

    /* =====================================================
       Shared open/show/update wrappers
    ===================================================== */
    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=originalOpenHomeFeature.apply(this,arguments);
            if(type==="announcement"){
                try{ localStorage.setItem(ANNOUNCEMENT_READ_KEY,"1"); }catch(_){ }
            }
            if(type==="autoBattleSettings"){ setTimeout(compactElementBoxPanel,0); }
            updateNotificationDots();
            return result;
        };
    }

    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            const result=originalShowPage.apply(this,arguments);
            const app=document.getElementById("app");
            if(app){ app.classList.toggle("v141-dungeon-active",page==="dungeon"); }
            if(page==="dungeon"){
                installDungeonNavigation();
                const content=document.getElementById("dungeonTabContent");
                if(content&&!content.innerHTML.trim()){ switchDungeonTab("daily"); }
            }
            if(page==="map"){
                installPatrolClickMovement();
                installTaskTracker();
                renderTaskTracker();
                requestAnimationFrame(clampTaskTracker);
            }
            updateNotificationDots();
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const originalUpdateUI=updateUI;
        updateUI=function(){
            const result=originalUpdateUI.apply(this,arguments);
            renderTaskTracker();
            updateNotificationDots();
            return result;
        };
    }

    /* =====================================================
       Global tap feedback
    ===================================================== */
    document.addEventListener("pointerdown",function(event){
        if(event.pointerType==="mouse"&&event.button!==0){ return; }
        const ripple=document.createElement("span");
        ripple.className="v141-tap-ripple";
        ripple.style.left=event.clientX+"px";
        ripple.style.top=event.clientY+"px";
        document.body.appendChild(ripple);
        setTimeout(()=>ripple.remove(),520);
    },{passive:true});

    function boot(){
        installDungeonNavigation();
        installPatrolClickMovement();
        installTaskTracker();
        ensureInventoryPager();
        updateNotificationDots();
        const preview=document.getElementById("allElementSkillPreviewModal");
        if(preview&&preview.parentElement!==document.body){ document.body.appendChild(preview); preview.classList.add("v141-body-preview"); }
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }
})();
