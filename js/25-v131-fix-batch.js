/* V131 — targeted gameplay/UI fixes for request batch 17. */
(function installV131FixBatch(){
    "use strict";

    /*
       ★ 修正（依照使用者要求，「修復回合與回合之間的
       空拍太久問題，把它固定為1.5秒」）：1300→1500。
    */
    const V131_RESOLVE_DELAY_MS=1500;
    const V131_MONSTER_STRENGTH=1.30;
    const V131_EXP_MULTIPLIER=3.5;
    const ELEMENT_BOX_REWARD_MS=8*60*60*1000;
    const ELEMENT_BOX_KEY="v131_element_box_state";

    /*
       ★ 新增（依照使用者要求，經濟／養成重新設計第一輪）：
       1. 精英/BOSS的戰鬥EXP要比普通怪高（精英×1.5、BOSS×3），
          原本不管rank一律是「等級×10」，這裡在既有×3.5加成
          「之前」先套rank倍率，兩個倍率疊乘、不是另外多加一次
          ×3.5（使用者明確要求×3.5保留、不要再疊加）。
       2. 元素匣（自動掛機）戰鬥的EXP只給70%，金幣/掉落/材料
          完全不受影響（那些是另外獨立的函式，這裡完全沒有動）。
          目的是讓「掛機」明顯比「手動玩」慢，避免無腦掛機
          就能在短時間衝到滿等。
    */
    const ELEMENT_BOX_EXP_RATIO=0.70;

    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    function getFormationRows(indexes){
        const list=(indexes||[]).slice(0,10);
        const n=list.length;
        if(n<=5){ return [list,[]]; }
        if(n===6){ return [list.slice(0,3),list.slice(3,6)]; }
        return [list.slice(0,5),list.slice(5,10)];
    }

    function currentFormationRows(){
        return getFormationRows(currentBattleMonsters);
    }

    function formatDuration(ms){
        const safe=Math.max(0,Math.floor(Number(ms)||0));
        const totalMinutes=Math.floor(safe/60000);
        const hours=Math.floor(totalMinutes/60);
        const minutes=totalMinutes%60;
        return hours+"小時 "+minutes+"分鐘";
    }

    if(typeof finishPlayerAction==="function"){
        finishPlayerAction=function(){
            if(!battleActive){ return; }
            clearInterval(timerId);
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();
            if(checkBattleEnd()){ return; }
            if(battleAdvanceScheduled){ return; }
            battleAdvanceScheduled=true;
            const token=battleToken;

            if(battlePhase==="declare"){
                activeBattleCharacterIndex++;
                battleAdvanceTimeoutId=setTimeout(()=>{
                    battleAdvanceTimeoutId=null;
                    battleAdvanceScheduled=false;
                    if(!battleActive || token!==battleToken){ return; }
                    beginCharacterTurn(token);
                },BATTLE_DECLARE_ADVANCE_MS);
                return;
            }

            initiativeIndex++;
            battleAdvanceTimeoutId=setTimeout(()=>{
                battleAdvanceTimeoutId=null;
                battleAdvanceScheduled=false;
                if(!battleActive || token!==battleToken){ return; }
                try{
                    processNextCombatant(token);
                }catch(error){
                    console.error("V131 推進下一位時發生例外：",error);
                    addBattleLog(
                        "推進下一位時發生例外（"+
                        ((error&&error.message)||"未知錯誤")+
                        "），嘗試強制繼續。"
                    );
                    initiativeIndex++;
                    processNextCombatant(token);
                }
            },V131_RESOLVE_DELAY_MS);
        };
    }

    /*
       ★ 新增（依照使用者要求，「怪物之間的出手時間也調為1.5秒」，
       完整節奏：進入戰鬥＞1.5秒＞玩家1出手＞1.5秒＞玩家2出手＞
       1.5秒＞野怪1＞1.5秒＞野怪2＞1.5秒＞下一回合開始＞1.5秒＞
       玩家1出手……）：
       上面finishPlayerAction()的override已經確保「同一大回合內、
       每一位角色/怪物實際出手之間」都固定等V131_RESOLVE_DELAY_MS，
       但漏了兩個時間點——「進入戰鬥」到「這一回合第一位出手」、
       跟「下一回合開始」到「新回合第一位出手」——這兩個時間點
       原本都是宣告階段一結束，startResolutionPhase()馬上同步呼叫
       processNextCombatant()，中間完全沒有停頓，造成「每回合的
       第一下出手感覺特別快、節奏跟其他出手對不起來」。

       這裡不改寫startResolutionPhase()本體（避免重做一套複雜的
       結算階段初始化邏輯），改成標記法：startResolutionPhase()
       被呼叫的當下，設一個旗標記住「等一下processNextCombatant()
       第一次被呼叫時，要先補這1.5秒的停頓」；processNextCombatant()
       這邊只在偵測到這個旗標時，才把「真正執行」包進
       setTimeout(...,V131_RESOLVE_DELAY_MS)裡延後，消費掉旗標後
       就不會再影響同一回合裡後面正常的呼叫（那些已經各自被
       finishPlayerAction()的1.5秒排程過了，不會被這裡重複延遲）。
    */
    let v131PendingFirstResolveDelay=false;

    if(typeof startResolutionPhase==="function"){
        const originalStartResolutionPhase=startResolutionPhase;
        startResolutionPhase=function(token){
            /*
               ★ 修正（實測抓到的bug）：startResolutionPhase()
               本體自己就有防重複呼叫的機制（resolutionPhaseStarted
               已經是true就直接return、不做任何事）——但如果我在
               呼叫原本函式「之前」就無條件把旗標設成true，遇到
               這種「重複呼叫、原本函式其實什麼都沒做」的情況，
               旗標還是會被錯誤地重新架上，導致之後某個不相關的
               processNextCombatant()呼叫被多延遲了一次1.5秒
               （量測到同一回合內兩位角色間距變成3秒的雙倍延遲）。
               這裡改成先複製原本函式自己的判斷條件，只有「這次
               呼叫真的會執行」時才架旗標，跟原本函式的行為完全
               對齊。
            */
            if(battleActive && token===battleToken && !resolutionPhaseStarted){
                v131PendingFirstResolveDelay=true;
            }
            return originalStartResolutionPhase.apply(this,arguments);
        };
    }

    if(typeof processNextCombatant==="function"){
        const originalProcessNextCombatant=processNextCombatant;
        processNextCombatant=function(token){
            if(v131PendingFirstResolveDelay){
                v131PendingFirstResolveDelay=false;
                setTimeout(()=>{
                    if(!battleActive || token!==battleToken){ return; }
                    originalProcessNextCombatant.call(this,token);
                },V131_RESOLVE_DELAY_MS);
                return;
            }
            return originalProcessNextCombatant.apply(this,arguments);
        };
    }

    getSkillTargets=function(centerIndex,targetType){
        const alive=currentBattleMonsters.filter(
            i=>monsters[i] && monsters[i].alive
        );
        if(targetType==="all"){ return alive; }
        if(targetType==="single"){
            return monsters[centerIndex] && monsters[centerIndex].alive
                ? [centerIndex]
                : [];
        }
        if(targetType==="tri" || targetType==="row"){
            const rows=currentFormationRows();
            const row=rows.find(r=>r.includes(centerIndex));
            if(!row){ return []; }
            if(targetType==="row"){
                return row.filter(i=>monsters[i] && monsters[i].alive);
            }
            const pos=row.indexOf(centerIndex);
            return row
                .slice(Math.max(0,pos-1),Math.min(row.length,pos+2))
                .filter(i=>monsters[i] && monsters[i].alive);
        }
        return monsters[centerIndex] && monsters[centerIndex].alive
            ? [centerIndex]
            : [];
    };

    function applyBattleFormation(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        const indexes=currentBattleMonsters.slice(0,10);
        const rows=getFormationRows(indexes);
        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battleMonster"+index);
            if(card){ cards.set(index,card); }
        });
        area.innerHTML="";
        area.classList.add("v131-formation");
        area.dataset.monsterCount=String(indexes.length);
        rows.forEach((row,rowIndex)=>{
            if(row.length===0){ return; }
            const rowEl=document.createElement("div");
            rowEl.className="v131-monster-row v131-monster-row-"+(rowIndex+1);
            row.forEach(index=>{
                const card=cards.get(index);
                if(card){ rowEl.appendChild(card); }
            });
            area.appendChild(rowEl);
        });
    }

    let elementBoxBattleStartGold=null;
    let elementBoxBattleStartExp=null;

    if(typeof renderBattle==="function"){
        const originalRenderBattle=renderBattle;
        renderBattle=function(){
            originalRenderBattle.apply(this,arguments);
            applyBattleFormation();
            elementBoxBattleStartGold=Math.max(0,Number(gold)||0);
            elementBoxBattleStartExp=Math.max(0,Number(sharedExp)||0);
        };
    }

    function strengthenMonster(monster){
        if(!monster || monster._v131StrengthApplied){ return; }
        monster._v131StrengthApplied=true;
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*V131_MONSTER_STRENGTH));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
    }

    function strengthenAllZoneMonsters(){
        const arrays=[
            typeof forestMonsters!=="undefined" ? forestMonsters : null,
            typeof desertMonsters!=="undefined" ? desertMonsters : null,
            typeof iceMountainMonsters!=="undefined" ? iceMountainMonsters : null,
            typeof zone4Monsters!=="undefined" ? zone4Monsters : null,
            typeof zone5Monsters!=="undefined" ? zone5Monsters : null,
            typeof zone6Monsters!=="undefined" ? zone6Monsters : null,
            typeof zone7Monsters!=="undefined" ? zone7Monsters : null,
            typeof zone8Monsters!=="undefined" ? zone8Monsters : null,
            typeof zone9Monsters!=="undefined" ? zone9Monsters : null,
            typeof zone10Monsters!=="undefined" ? zone10Monsters : null
        ].filter(Boolean);
        const seen=new Set();
        arrays.forEach(zone=>zone.forEach(monster=>{
            if(!seen.has(monster)){
                seen.add(monster);
                strengthenMonster(monster);
            }
        }));
    }
    strengthenAllZoneMonsters();

    function syncInventoryPortrait(){
        const frame=document.getElementById("inventoryPortraitFrame");
        if(!frame || typeof getPartyCharacterByIndex!=="function"){ return; }
        const character=getPartyCharacterByIndex(inventoryCharacterIndex);
        if(!character){ return; }
        const placeholder=frame.querySelector(".inventory-portrait-placeholder");
        if(placeholder){ placeholder.style.display="none"; }
        let img=frame.querySelector(".v131-inventory-portrait");
        if(!img){
            img=document.createElement("img");
            img.className="v131-inventory-portrait";
            img.alt="角色立繪";
            img.draggable=false;
            frame.insertBefore(img,frame.firstChild);
        }
        img.src=getCharacterArtworkPath(character);
        img.alt=(character.id||"角色")+"立繪";
    }

    if(typeof renderInventory==="function"){
        const originalRenderInventory=renderInventory;
        renderInventory=function(){
            const result=originalRenderInventory.apply(this,arguments);
            syncInventoryPortrait();
            return result;
        };
    }

    function syncCharacterCreationAvailability(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const title=document.getElementById("homeFeatureModalTitle");
        if(title && title.textContent!=="角色"){ return; }
        const row=body.firstElementChild;
        if(!row || !row.children){ return; }

        [1,2].forEach(slotIndex=>{
            const card=row.children[slotIndex];
            if(!card){ return; }
            const character=slotIndex===1 ? player2 : player3;
            if(character){
                card.classList.remove("v131-unlock-ready");
                const oldDot=card.querySelector(".v131-unlock-dot");
                if(oldDot){ oldDot.remove(); }
                return;
            }
            const eligible=slotIndex===1
                ? player.level>=10
                : isThirdCharacterUnlocked();
            if(!eligible){ return; }
            const slotNumber=slotIndex+1;
            card.style.opacity="1";
            card.style.position="relative";
            card.style.cursor="pointer";
            card.classList.add("v131-unlock-ready");
            card.onclick=function(){
                closeHomeFeature();
                openCharacterCreation(slotNumber);
            };
            const labels=card.querySelectorAll("div");
            if(labels.length>=3){
                labels[1].textContent="可創建";
                labels[2].textContent="點擊創建";
            }
            if(!card.querySelector(".v131-unlock-dot")){
                const dot=document.createElement("span");
                dot.className="v131-unlock-dot";
                dot.setAttribute("aria-label","有新角色可創建");
                card.appendChild(dot);
            }
        });
    }

    if(typeof refreshCharacterAvatarLevels==="function"){
        const originalRefreshAvatarLevels=refreshCharacterAvatarLevels;
        refreshCharacterAvatarLevels=function(){
            originalRefreshAvatarLevels.apply(this,arguments);
            syncCharacterCreationAvailability();
        };
    }

    function promoteSkillPreview(){
        const modal=document.getElementById("allElementSkillPreviewModal");
        const overlay=document.getElementById("game-overlay-layer") || document.getElementById("game-stage");
        if(modal && overlay && modal.parentNode!==overlay){
            overlay.appendChild(modal);
        }
    }
    promoteSkillPreview();

    if(typeof learnSkill==="function"){
        const originalLearnSkill=learnSkill;
        learnSkill=function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalLearnSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            const actionText=before>0 ? "升級" : "學習";
            if(!window.confirm("確定要"+actionText+"「"+skill.name+"」嗎？")){
                return;
            }
            const result=originalLearnSkill.apply(this,arguments);
            const after=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(after>before){
                window.alert(
                    before>0
                    ? "「"+skill.name+"」升級成功！目前 Lv."+after+"。"
                    : "「"+skill.name+"」學習成功！"
                );
            }
            return result;
        };
    }

    /*
       ★ 修正（依照使用者要求，「技能升級時沒有跳出防呆訊息，
       只有學習時有跳出來」）：
       已學過但還沒滿級的技能，畫面上按的其實是upgradeSkill()，
       不是learnSkill()——上面那段只包了learnSkill，
       upgradeSkill完全沒被攔到，所以升級的時候
       不會有確認/成功提示。這裡用同一套邏輯
       （確認→執行→比對等級有沒有真的變化→跳成功提示）
       再包一次upgradeSkill。
    */
    if(typeof upgradeSkill==="function"){
        const originalUpgradeSkill=upgradeSkill;
        upgradeSkill=function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalUpgradeSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(!window.confirm("確定要升級「"+skill.name+"」嗎？")){
                return;
            }
            const result=originalUpgradeSkill.apply(this,arguments);
            const after=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(after>before){
                window.alert("「"+skill.name+"」升級成功！目前 Lv."+after+"。");
            }
            return result;
        };
    }

    /*
       ★ 修正：
       原本用 onclick="learnSkill(...)" 這種字串正則去猜
       這一列是哪個技能，但實際的技能列（.skill-row）
       用的是 upgradeSkill(...)（已學但未滿級時）而不只
       learnSkill(...)，正則沒涵蓋到，導致大部分列都抓不到
       skillId。改成直接讀icon那個<div id="skillIcon_xxx">
       的id，這個id本來就是渲染時直接塞技能id進去的，
       比猜onclick字串可靠。
    */
    function extractSkillIdFromRow(row){
        const iconEl=row.querySelector('[id^="skillIcon_"]');
        if(iconEl){
            return iconEl.id.slice("skillIcon_".length);
        }
        const controls=row.querySelectorAll("[onclick]");
        for(const control of controls){
            const code=control.getAttribute("onclick")||"";
            const match=code.match(/(?:learnSkill|upgradeSkill|equipSkill|unequipSkill)\(['\"]([^'\"]+)['\"]\)/);
            if(match){ return match[1]; }
        }
        return null;
    }

    /*
       ★ 修正：
       真正的技能列容器是 #allSkillsList 底下的
       .skill-row（不是原本猜的.learned-skill／
       .learnable-skill，那組class在目前版本的技能頁
       裡根本不存在，導致這個函式之前完全沒有作用）。
       技能名稱也是 .skill-row-text 裡的 <b>，不是
       <strong>。
    */
    function decorateSkillRows(){
        const list=document.getElementById("allSkillsList");
        if(!list){ return; }
        list.querySelectorAll(".skill-row").forEach(row=>{
            if(row.querySelector(".v131-skill-kind")){ return; }
            const skillId=extractSkillIdFromRow(row);
            const skill=skillId && skillDatabase[skillId];
            if(!skill || !["physical","magic"].includes(skill.category)){ return; }
            const badge=document.createElement("span");
            badge.className="v131-skill-kind "+skill.category;
            badge.textContent=skill.category==="physical" ? "物理" : "法術";
            const textHost=row.querySelector(".skill-row-text b,strong,.skill-name,.skill-row-name") || row;
            if(textHost===row){ row.insertBefore(badge,row.firstChild); }
            else{ textHost.insertAdjacentElement("afterend",badge); }
        });
    }

    if(typeof renderSkillLoadout==="function"){
        const originalRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const result=originalRenderSkillLoadout.apply(this,arguments);
            decorateSkillRows();
            return result;
        };
    }

    const expPreviewCounts={0:0,1:0,2:0};
    const originalDistributeExpToCharacter=
        typeof distributeExpToCharacter==="function" ? distributeExpToCharacter : null;

    function previewCostForCharacter(character,count){
        if(!character || count<=0){ return 0; }
        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||100);
        let total=0;
        for(let i=0;i<count;i++){
            const need=Math.max(1,expNext-exp);
            total+=need;
            exp=0;
            expNext=Math.max(expNext+1,Math.floor(expNext*1.2));
        }
        return total;
    }

    function totalPreviewCost(){
        return [0,1,2].reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            return sum+previewCostForCharacter(character,expPreviewCounts[index]||0);
        },0);
    }

    function hasExpPreview(){
        return [0,1,2].some(index=>(expPreviewCounts[index]||0)>0);
    }

    function previewExpLevel(index){
        const character=getPartyCharacterByIndex(index);
        if(!character){ return; }
        const current=expPreviewCounts[index]||0;
        const beforeCost=previewCostForCharacter(character,current);
        const afterCost=previewCostForCharacter(character,current+1);
        const extra=afterCost-beforeCost;
        if(totalPreviewCost()+extra>sharedExp){
            alert("經驗池不足，無法再預覽這一級。還需要 "+Math.max(0,totalPreviewCost()+extra-sharedExp)+" EXP。");
            return;
        }
        expPreviewCounts[index]=current+1;
        renderExpDistributeList();
        syncCharacterPreviewLevels();
    }

    function syncCharacterPreviewLevels(){
        [0,1,2].forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            const el=document.getElementById("characterAvatarLevel"+index);
            if(character && el){
                el.textContent="Lv."+(character.level+(expPreviewCounts[index]||0));
                el.classList.toggle("v131-preview-level",(expPreviewCounts[index]||0)>0);
            }
        });
    }

    function cancelExpPreview(){
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        renderExpDistributeList();
        if(typeof refreshCharacterAvatarLevels==="function"){
            refreshCharacterAvatarLevels();
        }
    }

    function confirmExpPreview(){
        if(!hasExpPreview() || !originalDistributeExpToCharacter){ return; }
        const plan=[0,1,2].map(index=>({
            index,
            character:getPartyCharacterByIndex(index),
            count:expPreviewCounts[index]||0
        })).filter(entry=>entry.character && entry.count>0);
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        plan.forEach(entry=>{
            for(let n=0;n<entry.count;n++){
                originalDistributeExpToCharacter(entry.character);
            }
        });
        renderExpDistributeList();
        syncCharacterCreationAvailability();
    }

    window.v131PreviewExpLevel=previewExpLevel;
    window.v131ConfirmExpPreview=confirmExpPreview;
    window.v131CancelExpPreview=cancelExpPreview;

    if(typeof renderExpDistributeList==="function"){
        renderExpDistributeList=function(){
            const container=document.getElementById("expDistributeList");
            if(!container){ return; }
            const rows=getExistingPartyIndexes().map(index=>{
                const character=getPartyCharacterByIndex(index);
                const count=expPreviewCounts[index]||0;
                const previewLevel=character.level+count;
                const cost=previewCostForCharacter(character,count);
                const nextExtra=previewCostForCharacter(character,count+1)-cost;
                const canPreview=totalPreviewCost()+nextExtra<=sharedExp;
                return (
                    '<div class="v131-exp-row">'+
                        '<div class="v131-exp-name">'+(character.id||("角色"+(index+1)))+'</div>'+
                        '<div class="v131-exp-level'+(count>0?' preview':'')+'">Lv.'+character.level+
                            (count>0 ? ' → Lv.'+previewLevel : '')+
                        '</div>'+
                        '<button type="button" class="v131-exp-preview-btn" '+
                            (canPreview?'':'disabled ')+
                            'onclick="v131PreviewExpLevel('+index+')">點擊預覽升級</button>'+
                    '</div>'
                );
            }).join("");
            const planned=hasExpPreview();
            const reserved=totalPreviewCost();
            container.innerHTML=
                rows+
                '<div class="v131-exp-preview-summary">預覽消耗：'+reserved.toLocaleString("zh-TW")+' EXP</div>'+
                '<div class="v131-exp-actions">'+
                    '<button type="button" class="v131-exp-confirm" '+(planned?'':'disabled ')+
                        'onclick="v131ConfirmExpPreview()">確定</button>'+
                    '<button type="button" class="v131-exp-back" '+(planned?'':'disabled ')+
                        'onclick="v131CancelExpPreview()">返回</button>'+
                '</div>';
            syncCharacterPreviewLevels();
        };
    }

    function loadElementBoxState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(ELEMENT_BOX_KEY)||"{}");
            return {remainingMs:Math.max(0,Number(parsed.remainingMs)||0)};
        }catch(_){
            return {remainingMs:0};
        }
    }

    const elementBoxState=loadElementBoxState();
    let elementBoxActive=false;
    let elementBoxLastTick=Date.now();
    let elementBoxLastPersist=0;
    const elementBoxSession={activeMs:0,battles:0,exp:0,gold:0};

    function persistElementBoxState(){
        try{
            localStorage.setItem(ELEMENT_BOX_KEY,JSON.stringify({
                remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
            }));
        }catch(_){ }
    }

    function stopElementBoxWhenTimeEnds(){
        elementBoxActive=false;
        autoConfig.enabled=false;
        if(player2){ autoConfig2.enabled=false; }
        if(player3){ autoConfig3.enabled=false; }
        autoBattle=false;
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
        addBattleLog("元素匣時數已用完，自動戰鬥已停止。");
    }

    function tickElementBoxClock(){
        const now=Date.now();
        const delta=Math.max(0,now-elementBoxLastTick);
        elementBoxLastTick=now;
        if(elementBoxActive && elementBoxState.remainingMs>0){
            const used=Math.min(delta,elementBoxState.remainingMs);
            elementBoxState.remainingMs-=used;
            elementBoxSession.activeMs+=used;
            if(elementBoxState.remainingMs<=0){
                elementBoxState.remainingMs=0;
                stopElementBoxWhenTimeEnds();
            }
        }
        if(now-elementBoxLastPersist>=5000){
            elementBoxLastPersist=now;
            persistElementBoxState();
        }
        updateElementBoxStatsUI();
    }

    function ensureElementBoxStatsUI(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        if(!panel){ return; }
        panel.classList.add("v131-element-box-panel");
        const saveBtn=panel.querySelector(".auto-save-btn");
        if(saveBtn){ saveBtn.textContent="套用並啟動"; }
        const cancelBtn=panel.querySelector(".auto-cancel-btn");
        if(cancelBtn){ cancelBtn.style.display="none"; }
        let stats=document.getElementById("v131ElementBoxStats");
        if(!stats){
            stats=document.createElement("section");
            stats.id="v131ElementBoxStats";
            stats.className="v131-element-box-stats";
            stats.innerHTML=
                '<div class="v131-element-box-title">本次上線元素匣紀錄</div>'+
                '<div><span>啟動總時數</span><strong id="v131EbActiveTime">0小時 0分鐘</strong></div>'+
                '<div><span>戰鬥次數</span><strong id="v131EbBattles">0</strong></div>'+
                '<div><span>獲得經驗</span><strong id="v131EbExp">0</strong></div>'+
                '<div><span>獲得金幣</span><strong id="v131EbGold">0</strong></div>'+
                '<div class="remaining"><span>元素匣剩餘使用時間</span><strong id="v131EbRemaining">0小時 0分鐘</strong></div>';
            const actions=panel.querySelector(".auto-settings-actions") || (saveBtn && saveBtn.parentElement);
            if(actions){ panel.insertBefore(stats,actions); }
            else{ panel.appendChild(stats); }
        }
        updateElementBoxStatsUI();
    }

    function updateElementBoxStatsUI(){
        const pairs={
            v131EbActiveTime:formatDuration(elementBoxSession.activeMs),
            v131EbBattles:String(elementBoxSession.battles),
            v131EbExp:Math.floor(elementBoxSession.exp).toLocaleString("zh-TW"),
            v131EbGold:Math.floor(elementBoxSession.gold).toLocaleString("zh-TW"),
            v131EbRemaining:formatDuration(elementBoxState.remainingMs)
        };
        Object.keys(pairs).forEach(id=>{
            const el=document.getElementById(id);
            if(el){ el.textContent=pairs[id]; }
        });
    }

    const originalConfirmAutoBattleSettings=
        typeof confirmAutoBattleSettings==="function" ? confirmAutoBattleSettings : null;

    if(originalConfirmAutoBattleSettings){
        confirmAutoBattleSettings=function(){
            /*
               ★ 修正（依照使用者回報，「戰鬥中開啟元素匣，
               套用啟動才是沒反應」）：
               這顆按鈕的文字被ensureElementBoxStatsUI()改成
               「套用並啟動」，但這裡原本只呼叫
               originalConfirmAutoBattleSettings()儲存表單設定，
               從頭到尾沒有真的把autoBattle打開——玩家看到的
               就是「按了套用並啟動，畫面卻什麼都沒變、戰鬥
               還是要自己手動操作」，跟按鈕文字承諾的行為對
               不起來。這裡補上：套用設定之後，如果目前還沒
               開自動戰鬥，直接呼叫既有的toggleAutoBattle()
               （跟按面板最上面「啟動」按鈕完全同一套邏輯，
               autoConfig/autoConfig2/autoConfig3、UI、戰鬤
               紀錄都會一起正確同步），讓「套用並啟動」名符
               其實。如果玩家點的當下自動戰鬥其實已經是開著的
               （只是想改設定），就不要再呼叫一次toggle，
               避免反而把它關掉。
            */
            const activate=()=>{
                originalConfirmAutoBattleSettings.apply(this,arguments);
                if(!autoBattle && typeof toggleAutoBattle==="function"){
                    toggleAutoBattle();
                }
                elementBoxActive=true;
                elementBoxLastTick=Date.now();
                persistElementBoxState();
                addBattleLog("元素匣已啟動，剩餘 "+formatDuration(elementBoxState.remainingMs)+"。");
            };
            if(elementBoxState.remainingMs<=0){
                const watch=window.confirm(
                    "元素匣目前沒有可用時數。\n觀看廣告可獲得 8 小時元素匣啟動時數。\n\n要觀看廣告嗎？"
                );
                if(!watch){ return; }
                showRewardedAd(
                    ()=>{
                        elementBoxState.remainingMs+=ELEMENT_BOX_REWARD_MS;
                        persistElementBoxState();
                        ensureElementBoxStatsUI();
                        activate();
                    },
                    ()=>{
                        alert("廣告未完成，未獲得元素匣時數。");
                    }
                );
                return;
            }
            activate();
        };
    }

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=originalOpenHomeFeature.apply(this,arguments);
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.toggle("v131-shop-open",type==="shop"); }
            if(type==="character"){ syncCharacterCreationAvailability(); }
            if(type==="autoBattleSettings"){ ensureElementBoxStatsUI(); }
            return result;
        };
    }

    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v131-shop-open"); }
            return originalCloseHomeFeature.apply(this,arguments);
        };
    }

    let v131PendingExpToast=0;
    if(typeof showExpToast==="function"){
        const originalShowExpToast=showExpToast;
        showExpToast=function(amount){
            const displayAmount=v131PendingExpToast>0 ? v131PendingExpToast : amount;
            v131PendingExpToast=0;
            return originalShowExpToast.call(this,displayAmount);
        };
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            if(!battleActive){ return originalWinBattle.apply(this,arguments); }

            /*
               flatExpGain：跟原本winBattle()內部自己會算、
               直接加進sharedExp的數字完全一樣算法（等級×10，
               不含rank倍率、不含3.5倍加成）——用來推算「原本
               函式這次會自己加多少」，才能正確算出還要「補多少
               差額」，不會跟原本的計算重複疊加。
            */
            const flatExpGain=currentBattleMonsters.reduce(
                (total,index)=>total+(monsters[index] ? (Number(monsters[index].level)||0)*10 : 0),
                0
            );

            /* rankAdjustedExp：這裡才是真正決定最終獎勵的基準，
               每隻怪先各自套rank倍率（普通×1／精英×1.5／BOSS×3），
               再統一乘上既有的3.5倍加成——兩個倍率是「疊乘」，
               不是額外多加一次3.5。 */
            const rankAdjustedExp=currentBattleMonsters.reduce(
                (total,index)=>{
                    const monster=monsters[index];
                    if(!monster){ return total; }
                    return total+(Number(monster.level)||0)*10*getMonsterExpRankMultiplier(monster);
                },
                0
            );

            let finalExp=Math.floor(rankAdjustedExp*V131_EXP_MULTIPLIER);

            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響
               （那些各自獨立的函式完全沒有被這裡動到）。 */
            const isElementBoxBattle=elementBoxActive;
            if(isElementBoxBattle){
                /* ★ 用Math.round不用Math.floor：700*0.7在浮點數運算下
                   會是489.999999...，Math.floor會誤差扣掉1點EXP，
                   Math.round才會正確算出490。 */
                finalExp=Math.round(finalExp*ELEMENT_BOX_EXP_RATIO);
            }

            const bonusExp=finalExp-flatExpGain;
            const battleGoldStart=elementBoxBattleStartGold===null ? gold : elementBoxBattleStartGold;
            const result=originalWinBattle.apply(this,arguments);
            if(bonusExp!==0){
                sharedExp=Math.max(0,sharedExp+bonusExp);
                addBattleLog(
                    (isElementBoxBattle
                        ? "戰鬥經驗（精英/BOSS加成＋3.5倍加成，元素匣掛機70%）："
                        : "戰鬥經驗（精英/BOSS加成＋3.5倍加成）：")+
                    "本場共 "+finalExp+" EXP。"
                );
                saveGame();
            }
            v131PendingExpToast=finalExp;
            if(elementBoxActive){
                elementBoxSession.battles++;
                elementBoxSession.exp+=finalExp;
                elementBoxSession.gold+=Math.max(0,(Number(gold)||0)-(Number(battleGoldStart)||0));
                updateElementBoxStatsUI();
            }
            elementBoxBattleStartGold=null;
            elementBoxBattleStartExp=null;
            return result;
        };
    }

    function initialSync(){
        applyBattleFormation();
        syncInventoryPortrait();
        decorateSkillRows();
        promoteSkillPreview();
        syncCharacterCreationAvailability();
        renderExpDistributeList();
        ensureElementBoxStatsUI();
    }

    setInterval(tickElementBoxClock,1000);
    window.addEventListener("beforeunload",persistElementBoxState);
    document.addEventListener("visibilitychange",()=>{ tickElementBoxClock(); });
    setTimeout(initialSync,0);
})();
