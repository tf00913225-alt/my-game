Y��x-���jם��i��+��j[h��ܢ���ݶۮv�}�o+^����ם
/* bundled source: js/25-v131-fix-batch.js */
/* V131 — targeted gameplay/UI fixes for request batch 17. */
(function installV131FixBatch(){
    "use strict";

    /*
       ★ V138：節奏拆成兩個明確規則。
       - 每一位有效角色／怪物出手後，等 1.6 秒才輪下一位。
       - 一整輪最後一位出手到下一輪第一位出手，總共固定 2 秒。

       舊版共用一個 1.25 秒常數，而且已死亡的佇列成員仍會逐個
       呼叫 finishPlayerAction()、每個再多等一次，尾端剛好有
       2～3 個死亡成員時就會累積成玩家感受到的 3～5 秒。
       V138 會在排程前一次略過所有已死亡空位。2 秒總轉場由
       0.4 秒的回合交接＋1.6 秒的首位出手等待組成，不會錯疊成
       2+1.6＝3.6 秒，也不會再隨死亡數量越拖越久。
    */
    const V138_ACTION_DELAY_MS=1600;
    const V138_ROUND_TRANSITION_MS=2000;
    const V138_ROUND_HANDOFF_DELAY_MS=Math.max(
        0,
        V138_ROUND_TRANSITION_MS-V138_ACTION_DELAY_MS
    );
    const V173_32_WILD_ZONE_STRENGTHS=Object.freeze([
        0.75,0.90,0.95,1.00,1.05,1.10,1.15,1.20,1.25,1.30
    ]);
    const V131_EXP_MULTIPLIER=3.5;
    const ELEMENT_BOX_REWARD_MS=8*60*60*1000;
    const ELEMENT_BOX_KEY=window.FourSymbolsAccountSave.accountKey("element-box-state");

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
    const V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3;
    const V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5;
    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;
    const V173_BEGINNER_FOREST_FALLBACK_EXP=690;

    function getBeginnerForestBattleExp(){
        if(typeof window.v133GetExpNextForLevel!=="function"){
            return V173_BEGINNER_FOREST_FALLBACK_EXP;
        }
        let totalRequired=0;
        for(let level=1;level<=9;level++){
            totalRequired+=Math.max(1,Math.round(Number(window.v133GetExpNextForLevel(level))||0));
        }
        return Math.max(1,Math.ceil(totalRequired/V173_BEGINNER_FOREST_TARGET_BATTLES));
    }

    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;

    function getBeginnerForestMonsterExpUnit(){
        /* V173.40 targeted ~20 battles using one flat battle reward.
           V173.42 keeps that old 3-monster reference value, but pays per
           defeated monster so 1 / 2 / 3 monsters are no longer identical. */
        return Math.max(1,Math.ceil(getBeginnerForestBattleExp()/3));
    }
    window.v17342GetBeginnerForestMonsterExpUnit=getBeginnerForestMonsterExpUnit;

    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    function getPatrolProgressionExpMultiplier(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return safeLevel<20 ? V17342_GLOBAL_EXP_REWARD_MULTIPLIER : 1;
    }

    function getPatrolProgressionReferenceLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,Math.floor(Number(window.v133GetHighestCreatedCharacterLevel())||1));
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const indexes=getExistingPartyIndexes();
            if(indexes&&indexes.length){
                return indexes.reduce((highest,index)=>{
                    const character=getPartyCharacterByIndex(index);
                    return character?Math.max(highest,Math.floor(Number(character.level)||1)):highest;
                },1);
            }
        }
        return typeof player!=="undefined"&&player ? Math.max(1,Math.floor(Number(player.level)||1)) : 1;
    }

    function calculateStandardPatrolExp(monsterList,progressionLevel){
        const rankAdjustedExp=(Array.isArray(monsterList)?monsterList:[]).reduce((total,monster)=>{
            if(!monster){ return total; }
            return total+(Number(monster.level)||0)*10*getMonsterExpRankMultiplier(monster);
        },0);
        return Math.max(0,Math.floor(
            rankAdjustedExp*V131_EXP_MULTIPLIER*getPatrolProgressionExpMultiplier(progressionLevel)
        ));
    }

    function applyPatrolExpMode(standardExp,options){
        const safeExp=Math.max(0,Math.floor(Number(standardExp)||0));
        const mode=options&&typeof options==="object"?options:{};
        if(mode.elementBox){ return Math.round(safeExp*ELEMENT_BOX_EXP_RATIO); }
        if(mode.rested){ return Math.round(safeExp*2); }
        return safeExp;
    }

    window.v173GetPatrolProgressionExpMultiplier=getPatrolProgressionExpMultiplier;
    window.v173GetPatrolProgressionReferenceLevel=getPatrolProgressionReferenceLevel;
    window.v173CalculateStandardPatrolExp=calculateStandardPatrolExp;
    window.v173ApplyPatrolExpMode=applyPatrolExpMode;

    function getFormationRankWeight(monsterIndex){
        const monster=monsters[monsterIndex];
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 2; }
        return 1;
    }

    function arrangeRowCenterFirst(monsterIndexes){
        const ranked=(monsterIndexes||[]).slice();
        const arranged=new Array(ranked.length);
        const centerOrder=[];
        const leftCenter=Math.floor((ranked.length-1)/2);
        const rightCenter=Math.ceil((ranked.length-1)/2);

        centerOrder.push(leftCenter);
        if(rightCenter!==leftCenter){ centerOrder.push(rightCenter); }
        for(let distance=1;centerOrder.length<ranked.length;distance++){
            const left=leftCenter-distance;
            const right=rightCenter+distance;
            if(left>=0){ centerOrder.push(left); }
            if(right<ranked.length){ centerOrder.push(right); }
        }

        ranked.forEach((monsterIndex,priorityIndex)=>{
            arranged[centerOrder[priorityIndex]]=monsterIndex;
        });
        return arranged;
    }

    function getFormationRows(indexes){
        const originalOrder=(indexes||[]).slice(0,10);
        const stablePosition=new Map(originalOrder.map((index,position)=>[index,position]));
        const ranked=originalOrder.slice().sort((a,b)=>{
            const rankDifference=getFormationRankWeight(b)-getFormationRankWeight(a);
            return rankDifference || stablePosition.get(a)-stablePosition.get(b);
        });
        const n=ranked.length;
        const rowSizes=n<=5 ? [n] : (n===6 ? [3,3] : [5,n-5]);
        const rows=[];
        let cursor=0;

        rowSizes.forEach(size=>{
            rows.push(arrangeRowCenterFirst(ranked.slice(cursor,cursor+size)));
            cursor+=size;
        });
        while(rows.length<2){ rows.push([]); }
        return rows;
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

    function isInitiativeEntryActive(entry){
        if(!entry){ return false; }
        if(entry.type==="player"){
            const character=getPartyCharacterByIndex(entry.characterIndex);
            return !!(character && character.hp>0);
        }
        if(entry.type==="monster"){
            const monster=monsters[entry.monsterIndex];
            return !!(monster && monster.alive);
        }
        return false;
    }

    function skipInactiveInitiativeEntries(){
        while(
            initiativeIndex<initiativeQueue.length &&
            !isInitiativeEntryActive(initiativeQueue[initiativeIndex])
        ){
            processedInitiativeIndexes.add(initiativeIndex);
            initiativeIndex++;
        }
    }

    function consumeBattleAdvanceDelayOverride(fallback){
        const override=typeof window!=="undefined"
            ?Number(window.__battleAdvanceDelayOverrideMs):NaN;
        if(typeof window!=="undefined"&&Number.isFinite(override)){
            delete window.__battleAdvanceDelayOverrideMs;
            return Math.max(0,override);
        }
        return fallback;
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
                const delayMs=consumeBattleAdvanceDelayOverride(BATTLE_DECLARE_ADVANCE_MS);
                battleAdvanceTimeoutId=setTimeout(()=>{
                    battleAdvanceTimeoutId=null;
                    battleAdvanceScheduled=false;
                    if(!battleActive || token!==battleToken){ return; }
                    beginCharacterTurn(token);
                },delayMs);
                return;
            }
            initiativeIndex++;
            skipInactiveInitiativeEntries();
            const normalDelayMs=
                initiativeIndex>=initiativeQueue.length
                ? V138_ROUND_HANDOFF_DELAY_MS
                : V138_ACTION_DELAY_MS;
            const delayMs=consumeBattleAdvanceDelayOverride(normalDelayMs);
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
            },delayMs);
        };
    }

    /*
       首位出手也套用跟一般有效出手相同的 1.6 秒節奏：
       進入戰鬥／新回合開始後，第一位實際行動者不會立即跳出。
       上面finishPlayerAction()的override已經確保「同一大回合內、
       每一位角色/怪物實際出手之間」都固定等V138_ACTION_DELAY_MS，
       但漏了兩個時間點——「進入戰鬥」到「這一回合第一位出手」、
       跟「下一回合開始」到「新回合第一位出手」——這兩個時間點
       原本都是宣告階段一結束，startResolutionPhase()馬上同步呼叫
       processNextCombatant()，中間完全沒有停頓，造成「每回合的
       第一下出手感覺特別快、節奏跟其他出手對不起來」。

       這裡不改寫startResolutionPhase()本體（避免重做一套複雜的
       結算階段初始化邏輯），改成標記法：startResolutionPhase()
       被呼叫的當下，設一個旗標記住「等一下processNextCombatant()
       第一次被呼叫時，要先補這段停頓」；processNextCombatant()
       這邊只在偵測到這個旗標時，才把「真正執行」包進
       setTimeout(...,V138_ACTION_DELAY_MS)裡延後，消費掉旗標後
       就不會再影響同一回合裡後面正常的呼叫（那些已經各自被
       finishPlayerAction()的排程過了，不會被這裡重複延遲）。
    */
    let v131PendingFirstResolveDelay=false;

    /*
       首位出手的等待要扣除宣告階段已花掉的時間：
       只把上面那個「第一位出手前補一段延遲」寫死成
       V138_ACTION_DELAY_MS 是不夠準的——宣告階段本身也會花時間
       （每個自動角色會經過 beginCharacterTurn 的 150ms 自動出手延遲，
       加上 finishPlayerAction 宣告分支的 BATTLE_DECLARE_ADVANCE_MS
       90ms），所以「回合開始 → 第一位出手」實際上會變成
       如果直接再等完整 1600ms，會讓第一位比後續出手多等宣告時間。

       改成以「這一回合開始的時間點」為錨：等待時間 =
       1600 - (宣告階段已經花掉的時間)，不足就不再等。這樣不管隊伍
       有幾個自動角色、宣告階段花多久，玩家看到的
       「第N回合開始 → 第一位出手」都會以 1.6 秒為目標。
       如果宣告階段本身就超過 1.6 秒（例如手動角色思考很久），
       等待會變成 0，玩家一按完就馬上結算，不會再無謂地多等。
    */
    let v131TurnStartedAt=0;

    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            if(battleActive && token===battleToken){
                v131TurnStartedAt=Date.now();
            }
            return originalStartTurn.apply(this,arguments);
        };
    }

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
               processNextCombatant()呼叫被多延遲一次
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

                /* 扣掉宣告階段已經花掉的時間，讓「回合開始→第一位
                   出手」剛好等於 V138_ACTION_DELAY_MS。 */
                const elapsed=v131TurnStartedAt>0 ? (Date.now()-v131TurnStartedAt) : 0;
                const wait=Math.max(0,V138_ACTION_DELAY_MS-elapsed);

                setTimeout(()=>{
                    if(!battleActive || token!==battleToken){ return; }
                    originalProcessNextCombatant.call(this,token);
                },wait);
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
            if(card){
                const monster=monsters[index];
                const rank=getMonsterRank(monster);
                card.dataset.element=(monster && monster.element)||"unknown";
                card.dataset.rank=rank==="boss" ? "boss" : (rank==="elite" ? "elite" : "regular");
                cards.set(index,card);
            }
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

    function applyPlayerElementFrames(){
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const card=document.getElementById("battlePlayerCard"+characterIndex);
            if(card){
                card.dataset.element=(character && character.element)||"unknown";
            }
        });
    }

    let elementBoxBattleStartExp=null;

    if(typeof renderBattle==="function"){
        const originalRenderBattle=renderBattle;
        renderBattle=function(){
            originalRenderBattle.apply(this,arguments);
            applyBattleFormation();
            applyPlayerElementFrames();
            elementBoxBattleStartExp=Math.max(0,Number(sharedExp)||0);
        };
    }

    window.v138GetFormationRows=getFormationRows;
    window.v138BattlePacing={
        actionDelayMs:V138_ACTION_DELAY_MS,
        roundDelayMs:V138_ROUND_TRANSITION_MS,
        roundHandoffDelayMs:V138_ROUND_HANDOFF_DELAY_MS
    };

    function strengthenMonster(monster,multiplier){
        if(!monster || monster._v131StrengthApplied){ return; }
        const strengthMultiplier=Number.isFinite(Number(multiplier))
            ? Number(multiplier)
            : V173_32_WILD_ZONE_STRENGTHS[V173_32_WILD_ZONE_STRENGTHS.length-1];
        monster._v131StrengthApplied=true;
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*strengthMultiplier));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
    }

    function strengthenAllZoneMonsters(){
        const zones=[
            [typeof forestMonsters!=="undefined" ? forestMonsters : null,V173_32_WILD_ZONE_STRENGTHS[0]],
            [typeof desertMonsters!=="undefined" ? desertMonsters : null,V173_32_WILD_ZONE_STRENGTHS[1]],
            [typeof iceMountainMonsters!=="undefined" ? iceMountainMonsters : null,V173_32_WILD_ZONE_STRENGTHS[2]],
            [typeof zone4Monsters!=="undefined" ? zone4Monsters : null,V173_32_WILD_ZONE_STRENGTHS[3]],
            [typeof zone5Monsters!=="undefined" ? zone5Monsters : null,V173_32_WILD_ZONE_STRENGTHS[4]],
            [typeof zone6Monsters!=="undefined" ? zone6Monsters : null,V173_32_WILD_ZONE_STRENGTHS[5]],
            [typeof zone7Monsters!=="undefined" ? zone7Monsters : null,V173_32_WILD_ZONE_STRENGTHS[6]],
            [typeof zone8Monsters!=="undefined" ? zone8Monsters : null,V173_32_WILD_ZONE_STRENGTHS[7]],
            [typeof zone9Monsters!=="undefined" ? zone9Monsters : null,V173_32_WILD_ZONE_STRENGTHS[8]],
            [typeof zone10Monsters!=="undefined" ? zone10Monsters : null,V173_32_WILD_ZONE_STRENGTHS[9]]
        ].filter(entry=>Array.isArray(entry[0]));
        const seen=new Set();
        zones.forEach(([zone,multiplier])=>zone.forEach(monster=>{
            if(!seen.has(monster)){
                seen.add(monster);
                strengthenMonster(monster,multiplier);
            }
        }));
    }
    window.v173WildZoneStrengthMultipliers=V173_32_WILD_ZONE_STRENGTHS;
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
        if(title && String(title.textContent||"").trim()!=="角色"){ return; }
        const legacyRow=body.firstElementChild;
        const cardsBySlot=new Map();
        Array.from(body.querySelectorAll('[onclick*="openCharacterCreation"]')).forEach(card=>{
            const match=String(card.getAttribute("onclick")||"").match(/openCharacterCreation\(\s*(2|3)\s*\)/);
            if(match){ cardsBySlot.set(Number(match[1]),card); }
        });

        [1,2].forEach(slotIndex=>{
            const slotNumber=slotIndex+1;
            const card=cardsBySlot.get(slotNumber) || (legacyRow&&legacyRow.children?legacyRow.children[slotIndex]:null);
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
        learnSkill=async function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalLearnSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            const actionText=before>0 ? "升級" : "學習";
            if(
                typeof window.rpgConfirm!=="function" ||
                !await window.rpgConfirm(
                    "確定要"+actionText+"「"+skill.name+"」嗎？",
                    {
                        title:actionText+"技能",
                        confirmText:"確定"+actionText,
                        cancelText:"返回"
                    }
                )
            ){
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
        upgradeSkill=async function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalUpgradeSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(
                typeof window.rpgConfirm!=="function" ||
                !await window.rpgConfirm(
                    "確定要升級「"+skill.name+"」嗎？",
                    {
                        title:"升級技能",
                        confirmText:"確定升級",
                        cancelText:"返回"
                    }
                )
            ){
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
            const skillId=extractSkillIdFromRow(row);
            const skill=skillId && skillDatabase[skillId];
            if(!skill){ return; }

            if(
                ["physical","magic"].includes(skill.category) &&
                !row.querySelector(".v131-skill-kind")
            ){
                const badge=document.createElement("span");
                badge.className="v131-skill-kind "+skill.category;
                badge.textContent=skill.category==="physical" ? "物理" : "法術";
                const nameHost=row.querySelector(".skill-row-text b,strong,.skill-name,.skill-row-name") || row;
                if(nameHost===row){ row.insertBefore(badge,row.firstChild); }
                else{ nameHost.insertAdjacentElement("afterend",badge); }
            }

            const loadout=characterSkillLoadouts[currentSkillCharacter];
            const learnedLevel=
                loadout && loadout.skillLevels
                ? Math.max(0,Number(loadout.skillLevels[skillId])||0)
                : 0;
            const textHost=row.querySelector(".skill-row-text");
            if(
                learnedLevel===0 &&
                textHost &&
                !textHost.querySelector(".v138-skill-learn-cost")
            ){
                const cost=document.createElement("span");
                cost.className="v138-skill-learn-cost";
                cost.textContent="學習需要 "+Math.max(0,Number(skill.learnCost)||0)+" 技能點";
                const detailLink=textHost.querySelector(".skill-row-detail-link");
                textHost.insertBefore(cost,detailLink||null);
            }
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
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        const startLevel=Math.max(1,Math.floor(Number(character.level)||1));
        if(startLevel+count>maxLevel){ return Infinity; }

        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||100);
        let previewLevel=startLevel;
        let total=0;
        for(let i=0;i<count;i++){
            const need=Math.max(1,expNext-exp);
            total+=need;
            exp=0;
            previewLevel++;
            expNext=typeof window.v133GetExpNextForLevel==="function"
                ? window.v133GetExpNextForLevel(previewLevel)
                : Math.max(expNext+1,Math.floor(expNext*1.2));
        }
        return total;
    }
    window.v131PreviewCostForCharacter=previewCostForCharacter;

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
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        if(character.level+current>=maxLevel){
            alert("這名角色已達 Lv."+maxLevel+" 滿等。");
            return;
        }
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
            count:Math.min(
                expPreviewCounts[index]||0,
                Math.max(
                    0,
                    (Number(window.v133MaxLevel)||Infinity)-
                    ((getPartyCharacterByIndex(index)||{}).level||1)
                )
            )
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
                const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
                const isMaxLevel=previewLevel>=maxLevel;
                const canPreview=!isMaxLevel && totalPreviewCost()+nextExtra<=sharedExp;
                return (
                    '<div class="v131-exp-row">'+
                        '<div class="v131-exp-name">'+(character.id||("角色"+(index+1)))+'</div>'+
                        '<div class="v131-exp-level'+(count>0?' preview':'')+'">Lv.'+character.level+
                            (count>0 ? ' → Lv.'+previewLevel : '')+
                        '</div>'+
                        '<button type="button" class="v131-exp-preview-btn" '+
                            (canPreview?'':'disabled ')+
                            'onclick="v131PreviewExpLevel('+index+')">'+
                            (isMaxLevel ? '已達滿等' : '點擊預覽升級')+'</button>'+
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
            return {
                remainingMs:Math.min(
                    32*60*60*1000,
                    Math.max(0,Number(parsed.remainingMs)||0)
                )
            };
        }catch(_){
            return {remainingMs:0};
        }
    }

    const elementBoxState=loadElementBoxState();

    function hasAnyAutoBattleEnabled(){
        return !!(
            autoBattle ||
            autoConfig.enabled ||
            (player2 && autoConfig2.enabled) ||
            (player3 && autoConfig3.enabled)
        );
    }

    /*
       V137：V136會保存自動戰鬥開關，但元素匣舊版每次重新載入都把
       active寫死成false。結果同一份已啟用的自動設定在reload後仍會
       自動出手，卻不扣元素匣時數、EXP也恢復100%。只要還有時數且
       任一角色的自動設定為開，就恢復同一個元素匣啟用狀態。
    */
    let elementBoxActive=
        elementBoxState.remainingMs>0 &&
        hasAnyAutoBattleEnabled();
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

    function stopElementBoxWhenTimeEnds(message){
        elementBoxActive=false;
        autoConfig.enabled=false;
        if(player2){ autoConfig2.enabled=false; }
        if(player3){ autoConfig3.enabled=false; }
        autoBattle=false;
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
        addBattleLog(message||"元素匣時數已用完，自動戰鬥已停止。");
        if(typeof saveGame==="function"){ saveGame(); }
    }

    function syncElementBoxForBattle(options){
        const silent=!!(options && options.silent);
        if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
            stopElementBoxWhenTimeEnds(
                silent
                    ? "元素匣沒有可用時數，自動戰鬥已停止。"
                    : "元素匣沒有可用時數，自動戰鬥已停止；請先取得時數。"
            );
            return false;
        }

        elementBoxActive=
            elementBoxState.remainingMs>0 &&
            hasAnyAutoBattleEnabled();
        elementBoxLastTick=Date.now();
        persistElementBoxState();
        return elementBoxActive;
    }
    window.v131SyncElementBoxForBattle=syncElementBoxForBattle;
    window.v131GetElementBoxState=function(){
        return {
            active:elementBoxActive,
            remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
        };
    };
    window.v131GrantElementBoxHours=function(hours,maxHours){
        const safeHours=Math.max(0,Number(hours)||0);
        const capMs=Math.max(0,Number(maxHours)||32)*60*60*1000;
        elementBoxState.remainingMs=Math.min(
            capMs,
            Math.max(0,elementBoxState.remainingMs)+safeHours*60*60*1000
        );
        persistElementBoxState();
        updateElementBoxStatsUI();
        return Math.max(0,Math.floor(elementBoxState.remainingMs));
    };

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

    /*
       元素匣的「本次上線獲得金幣」只記錄一般巡怪中實際入帳的怪物掉落。
       副本會設置 v132ActiveDungeonRun；V141 的野外精英掉落隔離旗標不是副本，
       仍維持和既有巡怪戰鬥統計相同的涵蓋範圍。
    */
    function isElementBoxNormalPatrolGoldTrackingActive(){
        const dungeonRun=window.v132ActiveDungeonRun;
        return !!(
            elementBoxActive &&
            (!dungeonRun || dungeonRun.v141EliteDropIsolation===true)
        );
    }

    function recordElementBoxMonsterGold(amount){
        const safeAmount=Math.max(0,Math.floor(Number(amount)||0));
        if(safeAmount<=0 || !isElementBoxNormalPatrolGoldTrackingActive()){
            return;
        }
        elementBoxSession.gold+=safeAmount;
        updateElementBoxStatsUI();
    }

    if(typeof awardMonsterGoldDrop==="function"){
        const originalAwardMonsterGoldDrop=awardMonsterGoldDrop;
        awardMonsterGoldDrop=function(){
            const baseAmount=Math.max(0,Number(originalAwardMonsterGoldDrop.apply(this,arguments))||0);
            const bonusAmount=Math.max(0,Math.floor(baseAmount*(V17342_GLOBAL_GOLD_REWARD_MULTIPLIER-1)));
            if(bonusAmount>0){
                gold+=bonusAmount;
                if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
            }
            const amount=baseAmount+bonusAmount;
            recordElementBoxMonsterGold(amount);
            return amount;
        };
    }

    const originalConfirmAutoBattleSettings=
        typeof confirmAutoBattleSettings==="function" ? confirmAutoBattleSettings : null;

    if(originalConfirmAutoBattleSettings){
        confirmAutoBattleSettings=async function(){
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
                const watch=
                    typeof window.rpgConfirm==="function" &&
                    await window.rpgConfirm(
                        "元素匣目前沒有可用時數。\n觀看廣告可獲得 8 小時元素匣啟動時數。\n\n要觀看廣告嗎？",
                        {
                            title:"補充元素匣時數",
                            confirmText:"觀看廣告",
                            cancelText:"稍後再說"
                        }
                    );
                if(!watch){ return; }
                showRewardedAd(
                    ()=>{
                        window.v131GrantElementBoxHours(8,32);
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

    /*
       所有能開啟自動戰鬥的入口都必須經過元素匣檢查。舊版只攔
       「套用並啟動」，戰鬥HUD上的直接切換鍵可以完全繞過廣告與
       時數。沒有時數時保留手動狀態並打開設定面板；有時數時才讓
       原本切換邏輯執行。
    */
    if(typeof toggleAutoBattle==="function"){
        const originalToggleAutoBattle=toggleAutoBattle;
        toggleAutoBattle=function(){
            const isTurningOn=!autoBattle;
            if(isTurningOn && elementBoxState.remainingMs<=0){
                alert("元素匣目前沒有可用時數，請先觀看廣告取得8小時時數。");
                if(typeof openHomeFeature==="function"){
                    openHomeFeature("autoBattleSettings");
                }
                return false;
            }

            const result=originalToggleAutoBattle.apply(this,arguments);
            syncElementBoxForBattle({silent:true});
            return result;
        };
    }

    /* startBattle()會從存檔的autoConfig重新打開自動狀態；每一場開始
       後再同步一次，避免reload或舊存檔直接繞過元素匣。 */
    if(typeof startBattle==="function"){
        const originalStartBattle=startBattle;
        startBattle=function(){
            if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
                stopElementBoxWhenTimeEnds("元素匣沒有可用時數，自動戰鬥已停止。");
            }
            const result=originalStartBattle.apply(this,arguments);
            if(battleActive){ syncElementBoxForBattle({silent:true}); }
            return result;
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

            /* 正式巡怪 EXP 只走 calculateStandardPatrolExp()：
               怪物基礎 EXP × rank × 3.5；V173.42 ×3 僅保留 Lv1～19 快速期。
               Lv20 起不再有第二個全域 ×3。 */
            const progressionLevel=getPatrolProgressionReferenceLevel();
            let finalExp=calculateStandardPatrolExp(
                currentBattleMonsters.map(index=>monsters[index]).filter(Boolean),
                progressionLevel
            );

            const isBeginnerForestBattle=
                currentZone==="forest" &&
                typeof player!=="undefined" &&
                player &&
                Math.max(1,Number(player.level)||1)<10;

            if(isBeginnerForestBattle){
                const beginnerMonsterUnits=currentBattleMonsters.reduce((total,index)=>{
                    const monster=monsters[index];
                    return monster ? total+getMonsterExpRankMultiplier(monster) : total;
                },0);
                finalExp=Math.max(1,Math.round(
                    getBeginnerForestMonsterExpUnit()*
                    Math.max(1,beginnerMonsterUnits)*
                    V17342_GLOBAL_EXP_REWARD_MULTIPLIER
                ));
            }

            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響
               （那些各自獨立的函式完全沒有被這裡動到）。 */
            const isElementBoxBattle=elementBoxActive;
            let restedExpResult=null;
            if(isElementBoxBattle){
                /* ★ 用Math.round不用Math.floor：700*0.7在浮點數運算下
                   會是489.999999...，Math.floor會誤差扣掉1點EXP，
                   Math.round才會正確算出490。 */
                finalExp=applyPatrolExpMode(finalExp,{elementBox:true});
            }else if(typeof window.v139TryConsumeRestedBattle==="function"){
                /* V139休息經驗只允許一般練功戰鬥使用。副本勝利由
                   js/27先攔截，不會走進這個一般winBattle wrapper；
                   元素匣則在上面的分支明確排除，不會消耗場數。 */
                restedExpResult=window.v139TryConsumeRestedBattle();
                if(restedExpResult && restedExpResult.applied){
                    finalExp=applyPatrolExpMode(finalExp,{rested:true});
                }
            }

            const bonusExp=finalExp-flatExpGain;
            const result=originalWinBattle.apply(this,arguments);
            if(bonusExp!==0){
                sharedExp=Math.max(0,sharedExp+bonusExp);
                addBattleLog(
                    (isElementBoxBattle
                        ? "戰鬥經驗（元素匣收益70%）："
                        : restedExpResult && restedExpResult.applied
                        ? "戰鬥經驗（含休息經驗加成）："
                        : "戰鬥經驗：")+
                    "本場共 "+finalExp+" EXP。"
                );
                if(restedExpResult && restedExpResult.applied){
                    addBattleLog(
                        "休息經驗已生效，剩餘 "+
                        restedExpResult.remainingBattles+
                        " 場。"
                    );
                }
                saveGame();
            }
            v131PendingExpToast=finalExp;
            if(elementBoxActive){
                elementBoxSession.battles++;
                elementBoxSession.exp+=finalExp;
                updateElementBoxStatsUI();
            }
            elementBoxBattleStartExp=null;
            return result;
        };
    }

    function initialSync(){
        syncElementBoxForBattle({silent:true});
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


/* bundled source: js/27-v132-content-expansion.js */
/*
   V132 — 新增道具（符咒）、材料（礦石／裝備設計圖）、
   裝備套裝（赤炎／寒泉／岩岳／青嵐）、抽獎券、
   三個日常副本（經驗／材料／裝備）。

   ★ 整體設計原則：
   1. 儘量重用既有函式（makeZoneMonster()產生怪物、
      processNextCombatant()等回合引擎、renderBattle()/
      showPage()等既有UI渲染、showRewardedAd()廣告雙倍
      領取），不重新發明一套戰鬥/渲染邏輯，降低風險。
   2. 副本怪物借用「monsters這個全域陣列本來就是可以整包
      替換」的既有慣例（切換練功區域時就是直接整包换成
      對應區域的陣列，見js/00-main.js「目前所在區域的怪物
      資料」那段註解）——進副本前先記住原本的monsters/
      currentZone，副本結束後完整還原，不會弄壞巡怪系統。
   3. 素材/裝備視覺先用純CSS+inline SVG做出有辨識度的
      色塊圖示（依照使用者指示「先暫時用CSS/JavaScript
      動畫+Canvas/SVG/WebGL/Shader做出來，後期再用美術
      更改」），不做過度複雜的即時運算圖形，先求正確、
      好維護。
*/
(function installV132ContentExpansion(){
    "use strict";

    /* =====================================================
       0. 共用小工具
    ===================================================== */

    function todayString(){
        const now=new Date();
        const year=now.getFullYear();
        const month=String(now.getMonth()+1).padStart(2,"0");
        const day=String(now.getDate()).padStart(2,"0");
        return year+"-"+month+"-"+day;
    }

    function escapeHtml(text){
        return String(text==null ? "" : text)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    /*
       ★ 修正（根源問題）：物品清單格（inventory-icon）跟
       裝備欄（inventory-equipment-icon）都是用innerHTML
       塞item.icon，SVG字串能正常渲染；但物品詳細彈窗
       （openItemModal()/openEquippedItem()）是用
       textContent塞item.icon，SVG字串會被當成純文字
       原樣印出來，變成一整串看不懂的<svg>標籤文字。
       這裡在DOM渲染完之後，把圖示元素從textContent
       改回innerHTML，兩個函式都補這個收尾，不用整個
       複寫這兩個函式本體。
    */
    function fixItemModalIconRendering(){
        const iconEl=document.getElementById("itemModalIcon");
        if(!iconEl){ return; }
        const raw=iconEl.textContent;
        if(raw && raw.indexOf("<")!==-1){
            iconEl.innerHTML=raw;
        }
    }

    /*
       ★ 新增（依照使用者要求，「套裝效果顯示再點擊裝備的時候
       就應該顯示」）：不管是點背包裡還沒穿的套裝物品，還是點
       已經穿在身上的套裝物品，都在物品詳細彈窗補上「目前這件
       所屬套裝，這個角色身上已經穿了幾件／5件」跟兩條套裝加成
       說明，未達成的門檻用「未啟動」+較暗的樣式呈現，已達成的
       用「已啟動」+較亮的樣式呈現，一眼就能看出離下一階效果
       還差幾件。這裡刻意只「附加」在既有stats區塊後面，不去
       動getStatText()本身的輸出，一般裝備/非套裝物品完全不受
       影響（item.setId不存在時直接跳過）。
    */
    function appendEquipmentSetInfo(item){
        if(!item || !item.setId){ return; }
        const equipmentKey=getBackpackEquipmentKey(inventoryCharacterIndex);
        if(!equipmentKey){ return; }
        const counts=getEquipmentSetCounts(equipmentKey);
        const count=counts[item.setId]||0;
        const label=getSetLabel(item.setId);
        const elementKey=getSetElement(item.setId);
        const elementName=(elementKey && elementDatabase[elementKey]) ? elementDatabase[elementKey].name : "";
        const threeActive=count>=3;
        const fiveActive=count>=5;
        const html=
            '<div class="v132-set-info">'+
            '<div class="v132-set-title">['+escapeHtml(label)+']'+count+'/5</div>'+
            '<div class="v132-set-bonus'+(threeActive ? " active" : " inactive")+'">'+
            '裝備三件　全能力+1　'+(threeActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '<div class="v132-set-bonus'+(fiveActive ? " active" : " inactive")+'">'+
            '裝備五件　'+escapeHtml(elementName)+'元素技能傷害+2%　'+(fiveActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '</div>';
        const statsEl=document.getElementById("itemModalStats");
        if(statsEl){ statsEl.insertAdjacentHTML("beforeend",html); }
    }

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(inventorySlots[slotIndex]);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item,slot){
            const result=originalOpenEquippedItem.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(item);
            return result;
        };
    }


    /* =====================================================
       1. 圖示產生器（純CSS/SVG色塊，先求有辨識度）
    ===================================================== */

    const TIER_COLORS={
        white:{main:"#D8D8D8",glow:"#F2F2F2"},
        blue:{main:"#42A5FF",glow:"#7CC7FF"},
        purple:{main:"#B05CFF",glow:"#D49BFF"},
        orange:{main:"#FF9F38",glow:"#FFC46B"},
        pink:{main:"#FF4FA7",glow:"#FF8CC7"},
        "four-symbol":{main:"#E5C06B",glow:"#FFFFFF"}
    };

    function svgWrap(inner,glow){
        return (
            '<svg viewBox="0 0 64 64" width="100%" height="100%" '+
            'xmlns="http://www.w3.org/2000/svg" style="display:block;">'+
            '<defs><filter id="v132glow" x="-50%" y="-50%" width="200%" height="200%">'+
            '<feGaussianBlur stdDeviation="2.2" result="b"/>'+
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'+
            '</filter></defs>'+
            '<g filter="url(#v132glow)">'+inner+'</g>'+
            '</svg>'
        );
    }

    const TALISMAN_ART={
        freeze:"assets/items/talismans/freeze-icon.png",
        barrier:"assets/items/talismans/barrier-icon.png",
        stealth:"assets/items/talismans/stealth-icon.png"
    };
    const BLUEPRINT_ART={
        head:"assets/items/blueprints/head.png",
        shoulder:"assets/items/blueprints/shoulder.png",
        shoes:"assets/items/blueprints/shoes.png",
        hand:"assets/items/blueprints/hand.png",
        armor:"assets/items/blueprints/armor.png"
    };

    function rasterItemIcon(path,tier,kind){
        const rarity=tier?" v169-rarity-"+tier:"";
        return '<span class="v169-item-art v169-'+kind+'-art'+rarity+'">'+
            '<img src="'+path+'" alt="" aria-hidden="true" draggable="false" decoding="async" onerror="this.hidden=true"></span>';
    }

    function talismanIcon(effect,tier){
        return rasterItemIcon(TALISMAN_ART[effect]||TALISMAN_ART.freeze,tier,"talisman");
    }

    function oreIcon(tier){
        if(tier==="four-symbol"){
            return svgWrap(
                '<polygon points="32,6 52,22 44,56 20,56 12,22" fill="#181716" stroke="#f2dfb1" stroke-width="2.5"/>'+
                '<path d="M32 6L52 22L32 32Z" fill="#FF5A36" opacity=".9"/>'+
                '<path d="M52 22L44 56L32 32Z" fill="#42A5FF" opacity=".9"/>'+
                '<path d="M44 56H20L32 32Z" fill="#47D6A3" opacity=".9"/>'+
                '<path d="M20 56L12 22L32 32Z" fill="#C89B45" opacity=".9"/>',
                "#FFFFFF"
            );
        }
        const c=TIER_COLORS[tier]||TIER_COLORS.white;
        return svgWrap(
            '<polygon points="32,6 52,22 44,56 20,56 12,22" '+
            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+
            '<polygon points="32,6 44,56 20,56" fill="'+c.glow+'" opacity="0.28"/>',
            c.glow
        );
    }

    function blueprintIcon(slot,tier){
        return rasterItemIcon(BLUEPRINT_ART[slot]||BLUEPRINT_ART.hand,tier,"blueprint");
    }

    function chestIcon(){
        return rasterItemIcon("assets/items/chests/dungeon-chest.png","blue","chest");
    }
    // All general-dungeon backpack chests share this visual; item name stays semantic.
    window.v17361GeneralDungeonChestIcon=chestIcon;

    function ticketIcon(elementKey){
        return rasterItemIcon("assets/items/tickets/"+elementKey+"-icon.png",null,"ticket");
    }

    const SET_PALETTE={
        setFire:{main:"#d94a2a",glow:"#ffb37a",label:"赤炎"},
        setWater:{main:"#2a7ed9",glow:"#9ed4ff",label:"寒泉"},
        setEarth:{main:"#b3792a",glow:"#f0c987",label:"岩岳"},
        setWind:{main:"#2fa870",glow:"#a8f0cf",label:"青嵐"}
    };

    const EQUIPMENT_SET_ATTACK_ART={
        setFire:{
            blade:"assets/equipment/sets/fire-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/fire-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/fire-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/fire-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/fire-wristguard-attack-v173.22.webp"
        },
        setWater:{
            blade:"assets/equipment/sets/water-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/water-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/water-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/water-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/water-wristguard-attack-v173.22.webp"
        },
        setEarth:{
            blade:"assets/equipment/sets/earth-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/earth-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/earth-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/earth-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/earth-wristguard-attack-v173.22.webp"
        },
        setWind:{
            blade:"assets/equipment/sets/wind-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/wind-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/wind-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/wind-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/wind-wristguard-attack-v173.22.webp"
        }
    };

    const EQUIPMENT_SET_MAGIC_ART={
        setFire:{
            fan:"assets/equipment/sets/fire-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/fire-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/fire-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/fire-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/fire-focus-magic-v173.24.webp"
        },
        setWater:{
            fan:"assets/equipment/sets/water-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/water-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/water-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/water-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/water-focus-magic-v173.24.webp"
        },
        setEarth:{
            fan:"assets/equipment/sets/earth-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/earth-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/earth-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/earth-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/earth-focus-magic-v173.24.webp"
        },
        setWind:{
            fan:"assets/equipment/sets/wind-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/wind-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/wind-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/wind-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/wind-focus-magic-v173.24.webp"
        }
    };

    function equipmentSetIcon(setId,pieceKey){
        const attackArt=EQUIPMENT_SET_ATTACK_ART[setId];
        if(attackArt&&attackArt[pieceKey]){
            return rasterItemIcon(attackArt[pieceKey],null,"equipment");
        }
        const magicArt=EQUIPMENT_SET_MAGIC_ART[setId];
        if(magicArt&&magicArt[pieceKey]){
            return rasterItemIcon(magicArt[pieceKey],null,"equipment");
        }
        const c=SET_PALETTE[setId]||SET_PALETTE.setFire;
        const shapes={
            blade:'<path d="M32 6 L38 40 L32 58 L26 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            fan:'<path d="M32 58 L14 20 A22 22 0 0 1 50 20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            heavyArmor:'<path d="M16 14 L32 6 L48 14 L46 40 L32 58 L18 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            robe:'<path d="M22 8 H42 L48 56 H16 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            boots:'<path d="M22 6 H38 V34 L50 46 V58 H20 V40 H22 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            shoes:'<path d="M18 10 H36 V30 L52 40 V54 H16 V20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            helm:'<path d="M32 6 A20 20 0 0 1 52 26 V38 H12 V26 A20 20 0 0 1 32 6 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            crown:'<path d="M12 42 L16 18 L26 30 L32 12 L38 30 L48 18 L52 42 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            wristguard:'<rect x="16" y="22" width="32" height="20" rx="6" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            focus:'<circle cx="32" cy="32" r="20" fill="none" stroke="'+c.main+'" stroke-width="4"/><circle cx="32" cy="32" r="8" fill="'+c.glow+'"/>'
        };
        return svgWrap(shapes[pieceKey]||shapes.blade,c.glow);
    }


    /* =====================================================
       2. 正式階級與符咒（符咒固定只到橙階）
       - 舊 Low/Mid/High/Perfect 僅保留在穩定 id，兼容舊存檔。
       - 正式 tierKey 一律使用 white/blue/purple/orange/pink/four-symbol。
    ===================================================== */

    const FORMAL_ITEM_TIERS=[
        {key:"white",label:"白階",legacyKey:"low",idSuffix:"Low",available:true},
        {key:"blue",label:"藍階",legacyKey:"mid",idSuffix:"Mid",available:true},
        {key:"purple",label:"紫階",legacyKey:"high",idSuffix:"High",available:true},
        {key:"orange",label:"橙階",legacyKey:"perfect",idSuffix:"Perfect",available:true},
        {key:"pink",label:"桃紅階",legacyKey:null,idSuffix:"Pink",available:false,planned:true},
        {key:"four-symbol",label:"四象階",legacyKey:null,idSuffix:"FourSymbol",available:false,planned:true}
    ];
    const TALISMAN_ACTIVATION_CHANCES=[35,55,75,100];
    const TALISMAN_TIERS=FORMAL_ITEM_TIERS.slice(0,4).map((tier,index)=>
        Object.assign({},tier,{chance:TALISMAN_ACTIVATION_CHANCES[index]})
    );
    const RESOURCE_TIERS=FORMAL_ITEM_TIERS.slice();

    window.v17360FormalItemTiers=FORMAL_ITEM_TIERS.map(tier=>Object.assign({},tier));

    const TALISMAN_EFFECTS=[
        {key:"freeze",label:"冰封符",duration:4},
        {key:"stealth",label:"隱身符",duration:2},
        {key:"barrier",label:"結界符",duration:4}
    ];

    const talismanDefinitions=[];
    TALISMAN_EFFECTS.forEach(effect=>{
        TALISMAN_TIERS.forEach(tier=>{
            talismanDefinitions.push({
                // Stable legacy id is intentional: old saves and old drop pools keep resolving.
                id:effect.key+"Talisman"+tier.idSuffix,
                name:tier.label+effect.label,
                icon:talismanIcon(effect.key,tier.key),
                type:"talisman",
                talismanEffect:effect.key,
                talismanDuration:effect.duration,
                tierChance:tier.chance,
                tierKey:tier.key,
                legacyTierKey:tier.legacyKey,
                price:0,
                stats:{}
            });
        });
    });

    function getTalismanDefinition(id){
        return talismanDefinitions.find(def=>def.id===id)||null;
    }
    window.v132GetTalismanDefinition=getTalismanDefinition;


    /* =====================================================
       3. 礦石材料（正式六階；桃紅／四象先規劃、不進目前掉落）
    ===================================================== */

    const oreDefinitions=RESOURCE_TIERS.map(tier=>({
        id:"ore"+tier.idSuffix,
        name:tier.label+"礦石",
        icon:rasterItemIcon("assets/items/materials/ore.png",tier.key,"material"),
        type:"material",
        tierKey:tier.key,
        legacyTierKey:tier.legacyKey,
        available:tier.available!==false,
        planned:tier.planned===true,
        price:0,
        stats:{}
    }));

    function getOreDefinition(id){
        return oreDefinitions.find(def=>def.id===id)||null;
    }
    function getOreDefinitionByTier(tierKey){
        return oreDefinitions.find(def=>def.tierKey===tierKey)||null;
    }
    window.v132GetOreDefinitionByTier=getOreDefinitionByTier;


    /* =====================================================
       4. 裝備設計圖紙（5部位 × 正式六階 × 4系列）
       桃紅／四象先建立資料結構；目前材料寶箱不會抽到。
    ===================================================== */

    const BLUEPRINT_SLOTS=[
        {key:"head",label:"頭部"},
        {key:"shoulder",label:"護腕"},
        {key:"shoes",label:"鞋子"},
        {key:"hand",label:"武器"},
        {key:"armor",label:"衣服"}
    ];

    const BLUEPRINT_SERIES=[
        {id:"setFire",label:"赤炎"},
        {id:"setWater",label:"寒泉"},
        {id:"setEarth",label:"岩岳"},
        {id:"setWind",label:"青嵐"}
    ];

    const blueprintDefinitions=[];
    BLUEPRINT_SLOTS.forEach(slot=>{
        RESOURCE_TIERS.forEach(tier=>{
            BLUEPRINT_SERIES.forEach(series=>{
                blueprintDefinitions.push({
                    id:"blueprint"+series.id.replace("set","")+slot.key.charAt(0).toUpperCase()+slot.key.slice(1)+tier.idSuffix,
                    name:series.label+tier.label+slot.label+"設計圖",
                    icon:blueprintIcon(slot.key,tier.key),
                    type:"material",
                    blueprintSlot:slot.key,
                    tierKey:tier.key,
                    legacyTierKey:tier.legacyKey,
                    available:tier.available!==false,
                    planned:tier.planned===true,
                    setId:series.id,
                    price:0,
                    stats:{}
                });
            });
        });
    });

    function getBlueprintDefinitionsByTier(tierKey){
        return blueprintDefinitions.filter(def=>def.tierKey===tierKey);
    }


    /* =====================================================
       5. 裝備套裝抽獎券（赤炎／寒泉／岩岳／青嵐）
    ===================================================== */

    const ticketDefinitions=[
        {id:"ticketSetFire",name:"赤炎裝備抽獎券",setId:"setFire",icon:ticketIcon("fire")},
        {id:"ticketSetWater",name:"寒泉裝備抽獎券",setId:"setWater",icon:ticketIcon("water")},
        {id:"ticketSetEarth",name:"岩岳裝備抽獎券",setId:"setEarth",icon:ticketIcon("earth")},
        {id:"ticketSetWind",name:"青嵐裝備抽獎券",setId:"setWind",icon:ticketIcon("wind")}
    ].map(base=>Object.assign({
        type:"ticket",
        price:0,
        stats:{}
    },base));

    function getTicketDefinition(id){
        return ticketDefinitions.find(def=>def.id===id)||null;
    }

    /*
       V169：抽獎券圖改為 inbox 提供的 PNG 後，舊存檔仍會保留
       當時寫入物件裡的 inline SVG（或空 icon）。依穩定 id 只同步
       四張抽獎券的展示資料，不碰數量、掉落與套裝裝備本體。
    */
    function syncTicketPresentation(item,definition){
        if(!item || !definition || item.id!==definition.id){ return item; }
        item.name=definition.name;
        item.icon=definition.icon;
        item.type=definition.type;
        item.setId=definition.setId;
        item.price=definition.price;
        return item;
    }

    function hydrateOwnedTicketPresentation(){
        inventoryItems.forEach(item=>{
            const definition=item&&getTicketDefinition(item.id);
            if(definition){ syncTicketPresentation(item,definition); }
        });
    }

    function syncStaticContentPresentation(item,definition){
        if(!item || !definition || item.id!==definition.id){ return item; }
        [
            "name","icon","type","price","setId","tierKey","legacyTierKey","available","planned","blueprintSlot",
            "talismanEffect","talismanDuration","tierChance","sharedSkillId","talismanSkillLevel"
        ].forEach(key=>{
            if(Object.prototype.hasOwnProperty.call(definition,key)){
                item[key]=definition[key];
            }
        });
        if(!item.stats || typeof item.stats!=="object"){ item.stats={}; }
        return item;
    }

    function hydrateOwnedStaticContentPresentation(){
        const definitions=[].concat(talismanDefinitions,oreDefinitions,blueprintDefinitions);
        const definitionById=new Map(definitions.map(definition=>[definition.id,definition]));
        inventoryItems.forEach(item=>{
            const definition=item&&definitionById.get(item.id);
            if(definition){ syncStaticContentPresentation(item,definition); }
        });
    }


    /* =====================================================
       6. 裝備套裝本體（4元素 × 10件，共40件）
    ===================================================== */

    /*
       每個元素套裝10件＝5個部位、每個部位各2種變體
       （物理向／法術向），對應到既有的6個裝備欄位中的
       5個（head/hand/shoulder/armor/shoes），跟裝備
       設計圖紙涵蓋的部位完全對齊，戒指(ring)這次沒有
       套裝款式，維持原有可裝備物品即可。
    */

    const EQUIPMENT_SET_PIECES=[
        {key:"blade",slot:"weapon",name:"刀",stats:{attack:10,vitality:-2}},
        {key:"fan",slot:"weapon",name:"扇",stats:{intelligence:10,vitality:-2}},
        {key:"heavyArmor",slot:"armor",name:"鎧甲",stats:{attack:5,spirit:5}},
        {key:"robe",slot:"armor",name:"袍",stats:{intelligence:5,spirit:5}},
        {key:"boots",slot:"shoes",name:"靴",stats:{agility:10}},
        {key:"shoes",slot:"shoes",name:"履",stats:{agility:10}},
        {key:"helm",slot:"head",name:"盔",stats:{attack:12}},
        {key:"crown",slot:"head",name:"冠",stats:{intelligence:12}},
        {key:"wristguard",slot:"shoulder",name:"護腕",stats:{attack:12}},
        {key:"focus",slot:"shoulder",name:"法環",stats:{intelligence:12}}
    ];

    const EQUIPMENT_SETS=[
        {id:"setFire",label:"赤炎",element:"fire"},
        {id:"setWater",label:"寒泉",element:"water"},
        {id:"setEarth",label:"岩岳",element:"earth"},
        {id:"setWind",label:"青嵐",element:"wind"}
    ];

    const equipmentSetItemDefinitions=[];
    EQUIPMENT_SETS.forEach(set=>{
        EQUIPMENT_SET_PIECES.forEach(piece=>{
            equipmentSetItemDefinitions.push({
                id:set.id+"_"+piece.key,
                name:set.label+piece.name,
                icon:equipmentSetIcon(set.id,piece.key),
                type:piece.slot,
                setId:set.id,
                levelRequirement:20,
                price:0,
                stats:Object.assign({},piece.stats)
            });
        });
    });

    function getEquipmentSetItemDefinitions(setId){
        return equipmentSetItemDefinitions.filter(def=>def.setId===setId);
    }

    function getSetLabel(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.label : setId;
    }

    function getSetElement(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.element : null;
    }

    /*
       V141 合成／精英掉落共用資料橋接。
       回傳淺拷貝陣列，避免外部補丁誤改原始定義清單；單筆定義仍是
       同一個唯讀資料物件，背包加入時既有函式本來就會複製它。
    */
    window.v132GetOreDefinition=getOreDefinition;
    window.v132GetTicketDefinition=getTicketDefinition;
    window.v132GetBlueprintDefinition=function(id){
        return blueprintDefinitions.find(def=>def.id===id)||null;
    };
    window.v132GetEquipmentSetItemDefinitions=getEquipmentSetItemDefinitions;
    window.v132GetContentDefinitions=function(){
        return {
            talismans:talismanDefinitions.slice(),
            ores:oreDefinitions.slice(),
            blueprints:blueprintDefinitions.slice(),
            tickets:ticketDefinitions.slice(),
            equipmentSets:EQUIPMENT_SETS.slice(),
            equipmentSetItems:equipmentSetItemDefinitions.slice()
        };
    };


    /* =====================================================
       7. 通用「加入背包」函式（不限藥水，材料/符咒/設計圖/
          抽獎券/裝備都能用同一套堆疊規則）
    ===================================================== */

    function getItemInventoryCapacity(definition){
        if(!definition){ return 0; }
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;
        const matchingStacks=inventoryItems.filter(
            item=>item && item.id===definition.id
        );
        const stackFreeSpace=maxStack<=1
            ? 0
            : matchingStacks.reduce(
                (sum,item)=>sum+Math.max(0,maxStack-(Number(item.count)||0)),
                0
            );
        const freeSlots=Math.max(0,120-inventoryItems.length);
        return stackFreeSpace+freeSlots*maxStack;
    }

    function canAddItemToInventory(definition,amount){
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        return quantity<=getItemInventoryCapacity(definition);
    }
    window.v132CanAddItemToInventory=canAddItemToInventory;

    function addItemToInventory(definition,amount){
        if(!definition){ return false; }
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;

        /*
           V137：舊版是一邊塞、一邊才檢查102格上限，數量較大時可能
           已經放入一部分才回傳false，呼叫端卻把整筆視為失敗。
           先算完整容量，確定整批都放得下才開始改背包，讓加入操作
           具備all-or-nothing語意。
        */
        if(!canAddItemToInventory(definition,quantity)){ return false; }

        if(maxStack<=1){
            let remaining=quantity;
            while(remaining>0){
                if(inventoryItems.length>=120){
                    return false;
                }
                inventoryItems.push(cloneInventoryStackItem(definition,1));
                remaining--;
            }
            return true;
        }

        let remaining=quantity;
        const stacks=inventoryItems.filter(item=>item && item.id===definition.id);
        const ticketDefinition=getTicketDefinition(definition.id);
        stacks.forEach(stack=>{
            if(remaining<=0){ return; }
            if(ticketDefinition){ syncTicketPresentation(stack,ticketDefinition); }
            const current=Math.max(0,Math.floor(Number(stack.count)||0));
            const space=Math.max(0,maxStack-current);
            const add=Math.min(space,remaining);
            stack.count=current+add;
            remaining-=add;
        });

        while(remaining>0){
            if(inventoryItems.length>=120){
                return false;
            }
            const stackCount=Math.min(maxStack,remaining);
            inventoryItems.push(cloneInventoryStackItem(definition,stackCount));
            remaining-=stackCount;
        }

        return true;
    }

    window.v132AddItemToInventory=addItemToInventory;

    function cloneInventorySnapshot(){
        return inventoryItems.map(item=>{
            if(!item || typeof item!=="object"){ return item; }
            const copy={...item};
            copy.stats=item.stats && typeof item.stats==="object"
                ? {...item.stats}
                : {};
            return copy;
        });
    }

    function restoreInventorySnapshot(snapshot){
        inventoryItems.splice(
            0,
            inventoryItems.length,
            ...snapshot.map(item=>{
                if(!item || typeof item!=="object"){ return item; }
                const copy={...item};
                copy.stats=item.stats && typeof item.stats==="object"
                    ? {...item.stats}
                    : {};
                return copy;
            })
        );
    }

    function runInventoryTransaction(operation){
        const snapshot=cloneInventorySnapshot();
        try{
            if(operation()){ return true; }
        }catch(error){
            console.error("背包交易失敗，已還原：",error);
        }
        restoreInventorySnapshot(snapshot);
        return false;
    }

    /*
       通用「從背包扣掉N個某ID物品」——寶箱/抽獎券開啟都要用到
       同一種「消耗庫存」邏輯，寫成共用版本，不用每個新物品類型
       各自複製一份扣庫存的迴圈。找不到足夠庫存時完全不動背包，
       回傳false。
    */
    function consumeStackItem(itemId,amount){
        const needed=Math.max(1,Math.floor(Number(amount)||1));
        const owned=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==itemId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);
        if(owned<needed){ return false; }

        let remaining=needed;
        for(let index=inventoryItems.length-1;index>=0 && remaining>0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==itemId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            const take=Math.min(current,remaining);
            if(current-take<=0){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-take;
            }
            remaining-=take;
        }
        return true;
    }

    /* V141 bridge：合成系統沿用同一套原子背包交易與扣除邏輯。 */
    window.v132ConsumeStackItem=consumeStackItem;
    window.v132RunInventoryTransaction=runInventoryTransaction;


    /* =====================================================
       8. 一般練功掉落：4種低階道具各5%（每隻怪物擊殺各自
          獨立判定）
    ===================================================== */

    const NORMAL_DROP_POOL=[
        ()=>getTalismanDefinition("freezeTalismanLow"),
        ()=>getTalismanDefinition("stealthTalismanLow"),
        ()=>getTalismanDefinition("barrierTalismanLow"),
        ()=>getOreDefinition("oreLow")
    ];

    function awardMonsterMaterialDrop(monster){
        /*
           ★ 副本戰鬥不套用這組一般練功掉落——副本本身
           有自己獨立的寶箱獎勵流程（見下方第11節），
           兩邊各自負責各自的獎勵，不會疊加。
        */
        if(window.v132ActiveDungeonRun){ return; }

        const gained=[];
        NORMAL_DROP_POOL.forEach(getDef=>{
            if(Math.random()*100>=5){ return; }
            const definition=getDef();
            if(!definition){ return; }
            if(addItemToInventory(definition,1)){
                gained.push(definition.name);
            }
        });

        if(gained.length>0){
            addBattleLog(
                (monster && monster.name ? monster.name : "怪物")+
                "掉落了"+gained.join("、")+"。"
            );
            rebuildInventorySlots();
        }
    }

    if(typeof killMonster==="function"){
        const originalKillMonster=killMonster;
        killMonster=function(index){
            const monster=monsters[index];
            const result=originalKillMonster.apply(this,arguments);
            if(monster){
                awardMonsterMaterialDrop(monster);
            }
            return result;
        };
    }


    /* =====================================================
       9. 符咒使用：兩段判定
       1) 階級只決定「畫符／生效啟動」機率：35/55/75/100%。
       2) 畫符成功後，再以施放角色素質走對應滿級技能的命中規則。
       橙階 100% 代表一定畫符成功，不代表控制／符術一定命中。
    ===================================================== */

    function getTalismanActivationChance(definition){
        return Math.max(0,Math.min(100,Number(definition&&definition.tierChance)||0));
    }

    function getTalismanSharedSkill(definition){
        if(!definition||typeof skillDatabase==="undefined"){ return null; }
        const fallback={freeze:"freeze",stealth:"stealthSkill",barrier:"barrier"};
        const skillId=definition.sharedSkillId||fallback[definition.talismanEffect];
        return skillId?skillDatabase[skillId]||null:null;
    }

    function getTalismanCasterStats(characterIndex,character){
        if(typeof getPartyBattleStats==="function"){
            const stats=getPartyBattleStats(characterIndex);
            if(stats){ return stats; }
        }
        if(characterIndex===0&&typeof getMainCharacterStats==="function"){
            const stats=getMainCharacterStats();
            if(stats){ return stats; }
        }
        return character||{};
    }

    function rollTalismanSkillHit(definition,characterIndex,targetMonster){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return false; }
        const stats=getTalismanCasterStats(characterIndex,character);
        const skill=getTalismanSharedSkill(definition);
        if(skill){
            definition.talismanSkillLevel=Math.max(1,Math.floor(Number(skill.maxLevel)||1));
        }

        if(definition.talismanEffect==="freeze"&&targetMonster){
            const baseChance=Math.max(0,Number(skill&&skill.freezeChance)||0);
            const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;
            const targetSpirit=typeof getMonsterEffectiveSpiritPoints==="function"
                ?Number(getMonsterEffectiveSpiritPoints(targetMonster))||0
                :Number(targetMonster.spiritPoints||targetMonster.spirit)||0;
            const rank=typeof getMonsterRank==="function"?getMonsterRank(targetMonster):"regular";
            if(typeof rollStatusEffectHit==="function"){
                return rollStatusEffectHit(
                    baseChance,Number(character.level)||1,Number(targetMonster.level)||1,
                    intelligence,targetSpirit,true,rank,0
                );
            }
        }

        // 隱身／結界是友方符術，不拿友軍閃避懲罰施放者；使用角色自身命中值。
        const accuracy=Number(stats.accuracy);
        if(Number.isFinite(accuracy)&&typeof rollHitChance==="function"){
            return rollHitChance(accuracy,0,0);
        }
        const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;
        if(typeof rollStatusEffectHit==="function"){
            return rollStatusEffectHit(100,Number(character.level)||1,Number(character.level)||1,intelligence,0,false,"regular",0);
        }
        return true;
    }

    window.v17360GetTalismanActivationChance=getTalismanActivationChance;
    window.v17360RollTalismanSkillHit=rollTalismanSkillHit;

    function getTalismanInventoryItems(){
        const byId=new Map();
        inventoryItems.forEach(item=>{
            if(!item || item.type!=="talisman" || !item.id){ return; }
            const count=Math.max(0,Math.floor(Number(item.count)||0));
            if(count<=0){ return; }
            if(!byId.has(item.id)){
                byId.set(item.id,{...item,count:0});
            }
            byId.get(item.id).count+=count;
        });
        return Array.from(byId.values());
    }

    function consumeTalismanFromInventory(talismanId){
        for(let index=inventoryItems.length-1;index>=0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==talismanId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            if(current<=1){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-1;
            }
            return true;
        }
        return false;
    }

    /*
       ★ 新增（依照使用者要求，「點選符咒沒有問選擇目標」）：
       符咒現在完全比照技能的選目標流程——冰封符要玩家自己點要冰封
       哪一隻怪，隱身符/結界符要玩家自己點要給我方哪一位角色。

       作法上刻意「不」自己造一套選目標UI，而是直接沿用遊戲既有的
       那一整套（setBattleTargetSelectionMode/selectBattleTarget、
       setBattleAllyTargetSelectionMode/selectBattleAllyTarget），
       只把符咒id當成pendingAction傳進去。好處是提示文字、卡片高亮、
       「返回」取消、結算階段讀queued.target/queued.targetAlly……
       全部原本就是對的，不用重寫也不會跟技能的行為不一致。

       ★ 已確認的相容性重點（讀過00-main.js確認）：
       - selectBattleTarget()（11119）完全不查skillDatabase，只把
         pendingAction原封不動存進queuedPlayerActions，所以「選怪物」
         這條路徑不用改任何東西就能直接用符咒id。
       - 「選我方」那條路徑不行：setBattleAllyTargetSelectionMode()
         （10713）跟selectBattleAllyTarget()（10744）都會做
         skillDatabase[actionType] 並要求 targetType 是 ally/deadAlly，
         符咒id查不到就會整個當成無效。所以下面補了這兩個的覆寫，
         遇到符咒id時改用一個「長得像技能」的合成物件走同一套判斷。
       - getBattleActionDisplayName()（10609）查不到會直接回傳原始id，
         提示會變成「選擇 [freezeTalismanLow]」這種醜東西，也一起覆寫。
    */
    function getTalismanTargetKind(definition){
        if(!definition){ return null; }
        return definition.talismanEffect==="freeze" ? "monster" : "ally";
    }

    /* 給既有的我方選目標流程用的「合成技能物件」——只需要
       targetType 跟 name 這兩個欄位就能讓那套邏輯正常運作。 */
    function makeTalismanPseudoSkill(definition){
        return {
            id:definition.id,
            name:definition.name,
            targetType:"ally",
            category:"buff"
        };
    }

    if(typeof getBattleActionDisplayName==="function"){
        const originalGetBattleActionDisplayName=getBattleActionDisplayName;
        getBattleActionDisplayName=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(definition){ return definition.name; }
            return originalGetBattleActionDisplayName.apply(this,arguments);
        };
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const originalSetBattleAllyTargetSelectionMode=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(!definition){
                return originalSetBattleAllyTargetSelectionMode.apply(this,arguments);
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const region=document.getElementById("battleActionRegion");
            const promptAction=document.getElementById("battleTargetPromptAction");

            if(region){ region.classList.add("target-selecting"); }
            if(promptAction){
                promptAction.textContent="選擇 ["+definition.name+"] 的我方目標";
            }

            currentBattleMonsters.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.remove("targetable","target"); }
            });

            [0,1,2].forEach(index=>{
                const character=getBattleCharacterByIndex(index);
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){
                    card.classList.toggle(
                        "ally-targetable",
                        isValidAllyTargetForSkill(pseudoSkill,character,index)
                    );
                }
            });

            const targetText=document.getElementById("battleTarget");
            if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
        };
    }

    if(typeof selectBattleAllyTarget==="function"){
        const originalSelectBattleAllyTarget=selectBattleAllyTarget;
        selectBattleAllyTarget=function(index){
            const definition=getTalismanDefinition(pendingAction);
            if(!definition){
                return originalSelectBattleAllyTarget.apply(this,arguments);
            }

            if(!battleActive || battlePhase!=="declare" || !actionReady || !pendingAction){
                return;
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const character=getBattleCharacterByIndex(index);
            if(!isValidAllyTargetForSkill(pseudoSkill,character,index)){ return; }

            const action=pendingAction;
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();

            queuedPlayerActions[activeBattleCharacterIndex]={
                action:action,
                target:null,
                targetAlly:index
            };

            finishPlayerAction();
        };
    }

    function useTalisman(talismanId){
        const definition=getTalismanDefinition(talismanId);
        if(!definition){ return; }

        const autoOn=
            activeBattleCharacterIndex===0
            ? autoBattle
            : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

        if(!battleActive || autoOn || actionReady){ return; }

        const activeCharacter=getPartyCharacterByIndex(activeBattleCharacterIndex);
        if(!activeCharacter || activeCharacter.hp<=0){ return; }

        /*
           ★ 修正（依照使用者回報「三個人都使用符咒，結果都是一個人
           在使用」的第二個成因）：宣告階段要把「已經被其他角色預定
           走的符咒」也算進去。原本只看背包剩幾張，三個角色可以同時
           宣告同一張最後一張符咒，結算時先手用掉、後面兩位撞到
           「已經沒有庫存了」白白浪費一整個回合。
        */
        const ownedCount=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==talismanId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);

        const reservedCount=Object.keys(queuedPlayerActions).reduce((sum,key)=>{
            const queued=queuedPlayerActions[key];
            if(!queued || Number(key)===activeBattleCharacterIndex){ return sum; }
            return sum+(queued.action===talismanId ? 1 : 0);
        },0);

        if(ownedCount-reservedCount<=0){
            addBattleLog(
                definition.name+
                (reservedCount>0
                    ? "剩下的數量已經被這回合其他角色預定了。"
                    : "目前沒有庫存。")
            );
            renderBattleItemMenu();
            return;
        }

        /*
           ★ 進入選目標階段（而不是直接宣告完畢）：符咒id直接當成
           pendingAction，之後由既有的selectBattleTarget()／
           selectBattleAllyTarget()負責寫進queuedPlayerActions。
        */
        actionReady=true;
        pendingAction=talismanId;
        closeMenus();

        if(getTalismanTargetKind(definition)==="monster"){
            setBattleTargetSelectionMode(talismanId);
        }else{
            setBattleAllyTargetSelectionMode(talismanId);
        }

        updateUI();
    }
    window.useTalisman=useTalisman;

    function applyTalismanEffect(talismanId,characterIndex,queued){
        const definition=getTalismanDefinition(talismanId);
        const character=getPartyCharacterByIndex(characterIndex);

        if(!definition || !character){
            finishPlayerAction();
            return;
        }

        if(!consumeTalismanFromInventory(talismanId)){
            addBattleLog(definition.name+"已經沒有庫存了。");
            finishPlayerAction();
            return;
        }
        rebuildInventorySlots();

        /*
           ★ 修正（這就是使用者說「三個人都使用符咒，結果都是一個人
           在使用」的真正原因）：lungePlayerCard()跟showSkillNameBadge()
           的最後一個參數都是characterIndex，內部是
           $("battlePlayerCard"+(characterIndex||0))——原本這兩個呼叫
           都沒有傳，所以不管是誰施放，前傾動畫跟技能名稱都永遠演在
           0號角色的卡片上。二三號角色其實有正常結算（戰鬥紀錄有印、
           buff也有上），但畫面看起來就像「只有第一個人在用」。
           （同一個函式下面的showMissEffect()本來就有正確傳，所以
           「畫符失敗」反而一直是演在對的卡片上，剛好可以對照。）
        */
        lungePlayerCard(characterIndex);
        showSkillNameBadge(
            definition.name,
            definition.talismanEffect==="freeze" ? "water" : "wind",
            characterIndex
        );

        let targetIndex=null;
        let targetMonster=null;
        let allyIndex=null;
        let allyCharacter=null;
        let buffType=null;

        if(definition.talismanEffect==="freeze"){
            targetIndex=queued&&Number.isInteger(queued.target)?queued.target:null;
            if(targetIndex===null||!monsters[targetIndex]||!monsters[targetIndex].alive){
                const aliveTargets=currentBattleMonsters.filter(
                    index=>monsters[index]&&monsters[index].alive
                );
                if(aliveTargets.length===0){
                    addBattleLog(definition.name+"沒有可以生效的目標。");
                    finishPlayerAction();
                    return;
                }
                targetIndex=aliveTargets[Math.floor(Math.random()*aliveTargets.length)];
            }
            targetMonster=monsters[targetIndex];
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    targetMonster,"freeze","monster",targetIndex,definition.name
                )
            ){
                finishPlayerAction();
                return;
            }
        }else{
            allyIndex=queued&&Number.isInteger(queued.targetAlly)
                ?queued.targetAlly
                :characterIndex;
            allyCharacter=getBattleCharacterByIndex(allyIndex);
            if(!allyCharacter||allyCharacter.hp<=0){
                allyIndex=characterIndex;
                allyCharacter=character;
            }
            buffType=definition.talismanEffect==="stealth"?"stealthSkill":"barrier";
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    allyCharacter,buffType,"player",allyIndex,definition.name
                )
            ){
                finishPlayerAction();
                return;
            }
        }

        const activationChance=getTalismanActivationChance(definition);
        if(Math.random()*100>=activationChance){
            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");
            showMissEffect(true,characterIndex,"畫符失敗");
            finishPlayerAction();
            return;
        }

        if(!rollTalismanSkillHit(definition,characterIndex,targetMonster)){
            if(definition.talismanEffect==="freeze"&&targetMonster){
                addBattleLog(targetMonster.name+"抵抗了"+definition.name+"的冰封效果。");
            }else{
                addBattleLog((character.id||"你")+"的"+definition.name+"畫符成功，但符術未命中。");
            }
            showMissEffect(true,characterIndex,"MISS");
            finishPlayerAction();
            return;
        }

        if(definition.talismanEffect==="freeze"){
            applyFreezeEffect(targetMonster,definition.talismanDuration);
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，"+
                targetMonster.name+"被冰封了！"
            );
        }
        else{
            /*
               ★ 隱身符/結界符改成作用在玩家選的我方角色
               （queued.targetAlly），沒有選或那位已經倒下時才退回
               施法者自己。
            */
            allyCharacter.activeBuffs=allyCharacter.activeBuffs||[];
            const buff={type:buffType,turnsLeft:definition.talismanDuration};
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,buffType);
            }
            allyCharacter.activeBuffs.push(buff);

            const allyName=allyIndex===characterIndex
                ? (character.id||"你")
                : (allyCharacter.id||("角色"+(allyIndex+1)));

            addBattleLog(
                definition.talismanEffect==="stealth"
                    ? (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "進入隱身，無法被單體攻擊選中，持續"+definition.talismanDuration+"回合。"
                    : (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "獲得結界，可抵擋所有傷害，持續"+definition.talismanDuration+"回合。"
            );
        }

        updateUI();
        finishPlayerAction();
    }
    window.applyTalismanEffect=applyTalismanEffect;

    /*
       ★ 接進既有的「宣告後結算」dispatch點——跟potion
       同一個位置，找不到就代表這個版本的00-main.js結構
       跟預期不同，主動印出警告方便之後排查，不要默默失效。
    */
    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex];

            /*
               ★ 改成用「queued.action本身是不是一個符咒id」來判斷。
               以前是寫死 action==="talisman" 再另外存 talismanId，
               但現在符咒要走既有的選目標流程，而那套流程
               （selectBattleTarget/selectBattleAllyTarget）是把
               pendingAction原封不動寫進queued.action的，沒辦法順便
               多塞一個talismanId欄位——所以直接讓action帶符咒id，
               這裡用getTalismanDefinition()反查即可。
               同時把整個queued傳下去，讓結算端讀得到玩家選的
               target／targetAlly。
            */
            const talismanId=queued && queued.action ? queued.action : null;
            if(talismanId && getTalismanDefinition(talismanId)){
                activeBattleCharacterIndex=characterIndex;
                applyTalismanEffect(talismanId,characterIndex,queued);
                return;
            }

            return originalResolveQueuedPlayerAction.apply(this,arguments);
        };
    }
    else{
        console.warn("V132：找不到resolveQueuedPlayerAction()，符咒可能無法在戰鬥中結算，需要人工檢查00-main.js的函式名稱。");
    }

    /* 啟用戰鬥符咒清單按鈕（原本disabled，只列清單）。 */
    if(typeof renderBattleItemMenu==="function"){
        const originalRenderBattleItemMenu=renderBattleItemMenu;
        renderBattleItemMenu=function(){
            const result=originalRenderBattleItemMenu.apply(this,arguments);

            if(battleItemCategory!=="talisman"){ return result; }

            const list=document.getElementById("battlePotionList");
            if(!list){ return result; }

            const talismans=getTalismanInventoryItems();
            if(talismans.length===0){ return result; }

            list.innerHTML=talismans.map(item=>{
                const definition=getTalismanDefinition(item.id);
                const chanceLabel=definition ? definition.tierChance+"%" : "";
                return (
                    '<button type="button" class="battle-item-card talisman" '+
                    'onclick="useTalisman(\''+item.id+'\')" title="'+escapeHtml(item.name)+'">'+
                    '<span class="battle-item-badge">符</span>'+
                    '<span class="battle-item-name">'+escapeHtml(item.name)+'</span>'+
                    '<span class="battle-item-effect">生效機率 '+chanceLabel+'</span>'+
                    '<span class="battle-item-count">×'+item.count+'</span>'+
                    '</button>'
                );
            }).join("");

            return result;
        };
    }


    /* =====================================================
       10. 裝備套裝加成（3件：六圍全部+1／5件：對應元素
           技能傷害+2%），接進既有兩個唯一結算入口
    ===================================================== */

    function getEquipmentSetCounts(characterId){
        const equipment=characterEquipment[characterId];
        const counts={};
        if(!equipment){ return counts; }
        Object.values(equipment).forEach(item=>{
            if(item && item.setId){
                counts[item.setId]=(counts[item.setId]||0)+1;
            }
        });
        return counts;
    }
    window.v132GetEquipmentSetCounts=getEquipmentSetCounts;

    if(typeof getEquipmentBonus==="function"){
        const originalGetEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=originalGetEquipmentBonus.apply(this,arguments);
            const counts=getEquipmentSetCounts(characterId);

            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=3){
                    ["attack","vitality","energy","intelligence","spirit","agility"].forEach(stat=>{
                        bonus[stat]=(bonus[stat]||0)+1;
                    });
                }
            });

            return bonus;
        };
    }

    if(typeof getElementDamagePassiveMultiplier==="function"){
        const originalGetElementDamagePassiveMultiplier=getElementDamagePassiveMultiplier;
        getElementDamagePassiveMultiplier=function(character){
            let multiplier=originalGetElementDamagePassiveMultiplier.apply(this,arguments);

            if(!character || !character.element){ return multiplier; }

            const key=typeof getCharacterSkillKey==="function" ? getCharacterSkillKey(character) : null;
            const equipmentKey=key==="fire" ? "fire" : key;
            if(!equipmentKey){ return multiplier; }

            const counts=getEquipmentSetCounts(equipmentKey);
            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=5 && getSetElement(setId)===character.element){
                    multiplier+=0.02;
                }
            });

            return multiplier;
        };
    }


    /* =====================================================
       11. 裝備等級限制（20LV才能穿戴套裝裝備）
    ===================================================== */

    if(typeof equipSelectedItem==="function"){
        const originalEquipSelectedItem=equipSelectedItem;
        equipSelectedItem=function(){
            const item=inventorySlots[selectedInventorySlot];
            const character=getBackpackCharacter(inventoryCharacterIndex);

            if(
                item &&
                item.levelRequirement &&
                character &&
                (character.level||1)<item.levelRequirement
            ){
                alert(
                    item.name+"需要角色等級達到"+
                    item.levelRequirement+"級才能穿戴，"+
                    "目前等級："+(character.level||1)+"。"
                );
                return;
            }

            return originalEquipSelectedItem.apply(this,arguments);
        };
    }


    /* =====================================================
       12. 抽獎券使用（開啟後隨機獲得該系列裝備其中一件）
    ===================================================== */

    function useEquipmentTicket(ticketId){
        const definition=getTicketDefinition(ticketId);
        if(!definition){ return; }

        const owned=inventoryItems.some(item=>item && item.id===ticketId && Number(item.count)>0);
        if(!owned){
            alert(definition.name+"目前沒有庫存。");
            return;
        }

        const pieces=getEquipmentSetItemDefinitions(definition.setId);
        if(pieces.length===0){ return; }

        const won=pieces[Math.floor(Math.random()*pieces.length)];

        const added=runInventoryTransaction(()=>{
            return consumeStackItem(ticketId,1) && addItemToInventory(won,1);
        });
        rebuildInventorySlots();
        renderInventoryItems();

        if(!added){
            alert("背包空間不足，"+won.name+"無法放入背包；抽獎券未消耗。");
            return;
        }

        saveGame();
        alert("使用"+definition.name+"，獲得【"+won.name+"】！");
    }
    window.useEquipmentTicket=useEquipmentTicket;

    /*
       開啟寶箱/抽獎券之前，先讓玩家看看「這個東西開了可能拿到
       什麼」——重用既有的v132ShowRewardModal彈窗，不用另外做
       一整套新UI。
    */
    function formatPreviewProbability(value){
        const rounded=Math.round(Number(value)*10)/10;
        return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1))+"%";
    }

    function previewRow(icon,name,amount,probability){
        return (
            '<div class="v132-preview-row">'+
            '<span class="v132-preview-row-main">'+
            (icon ? '<span class="v132-preview-icon">'+icon+'</span>' : '')+
            '<span>'+escapeHtml(name)+(amount ? ' ×'+amount : '')+'</span>'+
            '</span>'+
            '<b>'+formatPreviewProbability(probability)+'</b>'+
            '</div>'
        );
    }

    function showItemPreview(item){
        if(!item){ return; }
        let html;

        if(item.type==="chest"){
            const oreRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const oreDef=getOreDefinitionByTier(tier.key);
                const amount=tier.key==="orange" ? 5 : 10;
                return oreDef ? previewRow(oreDef.icon,oreDef.name,amount,tier.weight) : "";
            }).join("");
            const blueprintRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const pool=getBlueprintDefinitionsByTier(tier.key);
                const eachChance=pool.length ? tier.weight/pool.length : 0;
                const amount=tier.key==="orange" ? 5 : 10;
                return pool.map(definition=>
                    previewRow(definition.icon,definition.name,amount,eachChance)
                ).join("");
            }).join("");
            html=
                '<div class="v132-reward-modal-inner">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>每次開啟會各獲得1組礦石與1種裝備設計圖；兩類獎勵分開抽取。</p>'+
                '<div class="v132-preview-section-title">可能獲得的礦石</div>'+
                '<div class="v132-preview-list">'+oreRows+'</div>'+
                '<div class="v132-preview-section-title">可能獲得的裝備設計圖</div>'+
                '<div class="v132-preview-list v132-preview-list-scroll">'+blueprintRows+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else if(item.type==="ticket"){
            const ticketDef=getTicketDefinition(item.id);
            const pieces=ticketDef ? getEquipmentSetItemDefinitions(ticketDef.setId) : [];
            const chance=pieces.length ? 100/pieces.length : 0;
            const grid=pieces.map(p=>
                '<button type="button" class="v132-preview-item" data-item-id="'+escapeHtml(p.id)+'" '+
                'aria-label="查看'+escapeHtml(p.name)+'詳細資料" '+
                'onclick="v132OpenPreviewEquipmentDetail(this.dataset.itemId)">'+
                '<span class="v132-preview-icon">'+p.icon+'</span>'+
                '<span class="v132-preview-item-name">'+escapeHtml(p.name)+'</span>'+
                '<b>'+formatPreviewProbability(chance)+'</b>'+
                '</button>'
            ).join("");
            html=
                '<div class="v132-reward-modal-inner v132-ticket-preview-modal">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>開啟後，從以下10件['+(ticketDef ? getSetLabel(ticketDef.setId) : "")+']套裝部位中'+
                '隨機獲得1件：</p>'+
                '<div class="v132-preview-grid">'+grid+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else{
            return;
        }

        v132ShowRewardModal(html);
    }
    window.v132ShowItemPreview=showItemPreview;

    function openPreviewEquipmentDetail(itemId){
        const item=equipmentSetItemDefinitions.find(definition=>definition.id===String(itemId||""));
        if(!item||typeof openEquippedItem!=="function"){ return; }

        const rewardModal=document.getElementById("v132RewardModal");
        if(rewardModal){ rewardModal.classList.add("v132-detail-paused"); }

        openEquippedItem(item,"");

        const modal=document.getElementById("itemModal");
        if(!modal){
            if(rewardModal){ rewardModal.classList.remove("v132-detail-paused"); }
            return;
        }

        modal.classList.add("v132-ticket-preview-detail");

        const title=document.getElementById("itemModalName");
        if(title){ title.textContent=item.name; }

        [
            document.getElementById("itemEquipButton"),
            modal.querySelector(".sell-button"),
            document.getElementById("v132ItemUseButton"),
            document.getElementById("v132ItemPreviewButton"),
            document.getElementById("v141DecomposeButton")
        ].forEach(button=>{ if(button){ button.style.display="none"; } });
    }
    window.v132OpenPreviewEquipmentDetail=openPreviewEquipmentDetail;

    /*
       ★ 物品詳細彈窗補上符咒/抽獎券/寶箱的「開啟」跟「預覽」
       按鈕——這幾種東西不是藥水（不走usePotion()那條路）、
       也不是裝備（不能穿戴），原本的itemEquipButton在這幾種
       類型上只會被判成「不可裝備」整個鎖死但還是顯示著，這裡
       依照 V138 最新規格，寶箱/抽獎券點開只顯示「開啟／預覽」
       兩個物品動作；穿戴與售出都隱藏，避免零售價物品被誤售。
    */
    if(typeof openItemModal==="function"){
        const afterOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            const result=afterOpenItemModal.apply(this,arguments);

            const item=inventorySlots[slotIndex];
            const equipButton=document.getElementById("itemEquipButton");
            const sellButton=document.querySelector("#itemModal .sell-button");
            let useButton=document.getElementById("v132ItemUseButton");
            let previewButton=document.getElementById("v132ItemPreviewButton");

            if(!useButton && equipButton && equipButton.parentElement){
                useButton=document.createElement("button");
                useButton.id="v132ItemUseButton";
                useButton.type="button";
                useButton.className=equipButton.className;
                equipButton.parentElement.insertBefore(useButton,equipButton.nextSibling);
            }

            if(!previewButton && useButton && useButton.parentElement){
                previewButton=document.createElement("button");
                previewButton.id="v132ItemPreviewButton";
                previewButton.type="button";
                previewButton.className=useButton.className;
                useButton.parentElement.insertBefore(previewButton,useButton.nextSibling);
            }

            const isChestOrTicket=item && (item.type==="chest" || item.type==="ticket");

            /*
               ★ 修正（依照使用者回報）：符咒不是裝備，但原本的
               openItemModal()只針對 type==="potion" 把「穿戴」鍵鎖住
               （js/00-main.js:30447），符咒會落到else分支變成一顆
               可以按的「穿戴」鍵——按下去因為
               getInventoryEquipmentSlot("talisman")查不到對應欄位，
               equipSelectedItem()只是靜默return，等於是一顆騙人的
               死按鈕。依使用者決定「符咒不能在戰鬥外使用」，這裡
               只把這顆錯誤的按鈕藏掉，不另外補「使用」鍵。
            */
            const isBattleOnlyItem=item && item.type==="talisman";

            if(equipButton){
                equipButton.style.display=
                    (isChestOrTicket || isBattleOnlyItem) ? "none" : "";
            }

            if(sellButton){
                sellButton.style.display=isChestOrTicket ? "none" : "";
            }

            if(isChestOrTicket){
                const statsEl=document.getElementById("itemModalStats");
                if(statsEl){
                    Array.from(statsEl.children).forEach(child=>{
                        if((child.textContent||"").includes("售價：")){
                            child.remove();
                        }
                    });
                }
            }

            if(useButton){
                if(item && item.type==="ticket"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        useEquipmentTicket(item.id);
                        closeItemModal();
                    };
                }
                else if(item && item.type==="chest"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        const opened=openSingleMaterialChestFromInventory();
                        closeItemModal();
                        if(opened){
                            alert("開啟"+item.name+"，獲得：\n"+opened.join("\n"));
                        }
                    };
                }
                else{
                    useButton.style.display="none";
                    useButton.onclick=null;
                }
            }

            if(previewButton){
                if(isChestOrTicket){
                    previewButton.style.display="";
                    previewButton.textContent="預覽";
                    previewButton.onclick=function(){
                        showItemPreview(item);
                    };
                }
                else{
                    previewButton.style.display="none";
                    previewButton.onclick=null;
                }
            }

            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const afterOpenEquippedItemActions=openEquippedItem;
        openEquippedItem=function(){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            const result=afterOpenEquippedItemActions.apply(this,arguments);
            const sellButton=document.querySelector("#itemModal .sell-button");
            const useButton=document.getElementById("v132ItemUseButton");
            const previewButton=document.getElementById("v132ItemPreviewButton");
            if(sellButton){ sellButton.style.display=""; }
            if(useButton){ useButton.style.display="none"; useButton.onclick=null; }
            if(previewButton){ previewButton.style.display="none"; previewButton.onclick=null; }
            return result;
        };
    }

    if(typeof closeItemModal==="function"){
        const afterCloseItemModal=closeItemModal;
        closeItemModal=function(){
            const modal=document.getElementById("itemModal");
            const returningToTicketPreview=!!(
                modal&&modal.classList.contains("v132-ticket-preview-detail")
            );
            const result=afterCloseItemModal.apply(this,arguments);
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            if(returningToTicketPreview){
                const rewardModal=document.getElementById("v132RewardModal");
                if(rewardModal){ rewardModal.classList.remove("v132-detail-paused"); }
            }
            return result;
        };
    }


    /* =====================================================
       13. 日常副本：每日次數狀態（獨立存檔，格式跟
           元素匣state同一套慣例，date跟今天不同就重置）
    ===================================================== */

    const DUNGEON_STATE_KEY=window.FourSymbolsAccountSave.accountKey("daily-dungeon-state");
    const DUNGEON_TYPES=["exp","material","equipment"];

    function loadDungeonState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(DUNGEON_STATE_KEY)||"{}");
            const state={date:parsed.date||todayString(),used:{}};
            DUNGEON_TYPES.forEach(type=>{
                state.used[type]=!!(parsed.used && parsed.used[type]);
            });
            return state;
        }catch(_){
            return {date:todayString(),used:{exp:false,material:false,equipment:false}};
        }
    }

    let dungeonState=loadDungeonState();

    function persistDungeonState(){
        try{
            localStorage.setItem(DUNGEON_STATE_KEY,JSON.stringify(dungeonState));
        }catch(_){ }
    }

    function ensureDungeonStateCurrent(){
        const today=todayString();
        if(dungeonState.date!==today){
            dungeonState={date:today,used:{exp:false,material:false,equipment:false}};
            persistDungeonState();
        }
    }

    /*
       ★ 修正（依照使用者要求，「副本先取消挑戰次數，方便我頻繁
       測試」）：先關掉每日次數限制，只要把這個常數改回true，
       markDungeonUsed()就會恢復正常記錄「今天挑戰過了」，
       isDungeonAvailable()/dungeonEntryCard()的UI也會自動恢復
       擋下重複挑戰，不用再改別的地方。
    */
    const DUNGEON_DAILY_LIMIT_ENABLED=false;

    function markDungeonUsed(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return; }
        ensureDungeonStateCurrent();
        dungeonState.used[type]=true;
        persistDungeonState();
    }

    /*
       ★ 修正（依照使用者回報「刪除角色了，為何副本次數沒有重置」）：
       上一版只在「寫入」端（markDungeonUsed）擋了旗標，「讀取」端
       （這裡跟dungeonEntryCard）卻照樣直接讀dungeonState.used——
       結果是旗標關掉之前就已經存進localStorage的used:true，會繼續
       讓按鈕永久disabled到隔天為止，看起來就像「次數根本沒解除」。
       讀取端也要一起看旗標，關閉時一律視為可挑戰。
    */
    function isDungeonUsedToday(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return false; }
        ensureDungeonStateCurrent();
        return !!dungeonState.used[type];
    }

    function isDungeonAvailable(type){
        return !isDungeonUsedToday(type);
    }
    window.v132IsDungeonAvailable=isDungeonAvailable;
    window.v132IsDungeonUsedToday=isDungeonUsedToday;

    function hasLevel10CharacterForDailyDungeon(){
        return getExistingPartyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return character && (Number(character.level)||1)>=10;
        }).length>=1;
    }
    window.v132HasLevel10CharacterForDailyDungeon=hasLevel10CharacterForDailyDungeon;
    window.v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon;

    /*
       ★ 修正（同一個回報的另一半）：副本次數是存在
       v132_daily_dungeon_state這個「獨立的localStorage key」裡，
       而刪角色用的resetGame()（js/00-main.js）只清SAVE_KEY跟兩個
       舊版存檔key，從來沒有碰過這個key——所以刪完角色重新創角，
       副本次數還是上一個角色用掉的狀態。

       這裡不去包resetGame()（它是先取得玩家確認再location.reload()，
       包在外面會變成「使用者按了取消，資料卻已經被清掉」），改成
       在腳本載入時判斷「目前根本沒有任何角色」——resetGame()會
       reload，reload後loadGame()找不到存檔，player.id會是空字串，
       這個時機點就是最乾淨的「全新開始」信號，順手把這兩個側邊
       key一起清乾淨。
    */
    (function resetSideCarStateWhenNoCharacter(){
        const hasAnyCharacter=
            (typeof player!=="undefined" && player && player.id) ||
            (typeof player2!=="undefined" && player2 && player2.id) ||
            (typeof player3!=="undefined" && player3 && player3.id);

        if(hasAnyCharacter){ return; }

        try{
            localStorage.removeItem(DUNGEON_STATE_KEY);
            localStorage.removeItem(window.FourSymbolsAccountSave.accountKey("element-box-state"));
        }catch(_){ }

        dungeonState={date:todayString(),used:{exp:false,material:false,equipment:false}};
    })();


    /* =====================================================
       14. 副本怪物等級公式：玩家總角色等級加總 ÷ 角色數量
    ===================================================== */

    /*
       ★ 修正（依照使用者明確指正）：
       原本「所有已建立角色等級總和÷角色數量」的算法，
       在高等主力帶低等角色時會把副本等級平均得很低
       （例如Lv.50+Lv.20+Lv.10只會算出約Lv.27），造成
       副本明顯偏簡單。改成「隊伍最高角色等級×0.70＋
       隊伍平均角色等級×0.30」，讓副本等級主要跟著隊伍
       裡最強的角色走，平均值只用來做小幅度的微調，
       不會再被低等角色拖累太多。只有一名角色時，
       最高等級跟平均等級相同，算出來還是原本的角色
       等級，行為不變。
    */
    function getDungeonMonsterLevel(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 1; }
        const levels=indexes.map(index=>{
            const character=getPartyCharacterByIndex(index);
            return (character && character.level)||1;
        });
        const maxLevel=Math.max(...levels);
        const avgLevel=levels.reduce((sum,l)=>sum+l,0)/levels.length;
        return Math.max(1,Math.round(maxLevel*0.70+avgLevel*0.30));
    }
    window.v132GetDungeonMonsterLevel=getDungeonMonsterLevel;

    const DUNGEON_ELEMENTS=["fire","water","earth","wind"];

    function randomElement(){
        return DUNGEON_ELEMENTS[Math.floor(Math.random()*DUNGEON_ELEMENTS.length)];
    }

    /* 副本普通怪的 HP／SP／防禦沿用既有耐久基準；攻擊與魔攻
       不在建怪階段放大，怪物對玩家的輸出統一交由敵方壓力倍率。 */
    const DUNGEON_MONSTER_STRENGTH=1.30;

    function applyDungeonMonsterStrength(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","defense"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_MONSTER_STRENGTH));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       ★ 新增（依照使用者要求，「副本怪物整體仍然偏弱」的
       第二輪調整）：
       上面的DUNGEON_MONSTER_STRENGTH（×1.30）只讓副本怪
       打平一般野怪，這裡疊加「副本普通怪」自己的額外強化
       （×1.10，含SP），讓同等級的副本普通怪本來就應該比
       野外普通怪再強一截（1.30×1.10≈1.43倍）。精英/BOSS
       都是先墊到這一層「副本普通怪」的完整數值，才各自再
       疊加精英/BOSS專屬倍率（見下面applyDungeonRankStrength），
       不是另外從裸數值重算，也不會讓×1.30被套用第二次
       ——這五個函式（makeZoneMonster→
       applyDungeonMonsterStrength→applyDungeonNormalBonus→
       applyDungeonRankStrength，全部包在buildDungeonMonster()
       裡）就是唯一負責副本怪數值的地方，一般野怪完全不會
       經過這裡，不受影響。
    */
    const DUNGEON_NORMAL_BONUS=1.10;

    function applyDungeonNormalBonus(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","defense"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_NORMAL_BONUS));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       精英/BOSS專屬倍率，都是從「副本普通怪」的完整數值
       （已經套過×1.30跟×1.10）再往上疊加，不重新從裸數值
       算起。V138 依最新規格在原有強度上再加：精英最終HP
       再+100%、SP+100%；BOSS最終HP再+50%、SP+100%。
       V173.38 起 rank 只放大生存資源；攻擊／魔攻不再於建怪階段
       乘算，敵方輸出壓力統一交由正式 enemyPressure 加算桶控制。
       HP倍率分別為3.20、4.50，SP兩者皆×2.00，防禦倍率保留。
       只認monster.rank（makeZoneMonster()第4個參數決定），
       一般怪（rank是undefined）這裡什麼都不做，直接跳過。
    */
    const DUNGEON_ELITE_MULTIPLIERS={maxHP:3.20,maxSP:2.00,defense:1.25};
    const DUNGEON_BOSS_MULTIPLIERS={maxHP:4.50,maxSP:2.00,defense:1.40};
    const EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS={maxHP:1.80,defense:1.10};
    const EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS={maxHP:2.80,defense:1.20};

    function applyDungeonRankStrength(monster){
        if(!monster){ return monster; }
        const multipliers=
            monster.rank==="elite" ? DUNGEON_ELITE_MULTIPLIERS :
            monster.rank==="boss" ? DUNGEON_BOSS_MULTIPLIERS :
            null;
        if(!multipliers){ return monster; }
        Object.keys(multipliers).forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*multipliers[key]));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /* 共用副本／深淵入口：完整普通基準後套共用 rank 倍率。
       裝備副本使用下方專用入口，避免與共用 rank 倍率疊乘。 */
    function buildDungeonMonster(name,level,element,rank){
        const monster=makeZoneMonster(name,level,element,rank);
        applyDungeonMonsterStrength(monster);
        applyDungeonNormalBonus(monster);
        applyDungeonRankStrength(monster);
        monster.v132Dungeon=true;
        return monster;
    }
    window.v132BuildDungeonMonster=buildDungeonMonster;

    function applyEquipmentDungeonRankStrength(monster){
        if(!monster){ return monster; }
        const multipliers=
            monster.rank==="elite" ? EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS :
            monster.rank==="boss" ? EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS :
            null;
        if(!multipliers){ return monster; }
        Object.keys(multipliers).forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*multipliers[key]));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    function buildEquipmentDungeonMonster(name,level,element,rank){
        const monster=makeZoneMonster(name,level,element,rank);
        applyDungeonMonsterStrength(monster);
        applyDungeonNormalBonus(monster);
        applyEquipmentDungeonRankStrength(monster);
        monster.v132Dungeon=true;
        monster.v132EquipmentDungeon=true;
        return monster;
    }
    window.v132BuildEquipmentDungeonMonster=buildEquipmentDungeonMonster;
    window.v173EquipmentDungeonRankMultipliers=Object.freeze({
        elite:Object.freeze(Object.assign({},EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS)),
        boss:Object.freeze(Object.assign({},EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS))
    });

    function setMonsterSkillTier(monster,tier,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===tier
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }

    function setMonsterMaxTierSkills(monster,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===4
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }

    function lockDungeonSkillConfiguration(monster,skillLevel){
        const level=Math.max(1,Math.floor(Number(skillLevel)||1));
        monster.v132FixedSkillLoadout=true;
        monster.v141ForceSkillLevel=level;
        monster.v141SkillLevel=level;
        monster.v144SkillLevel=level;
        return monster;
    }


    /* =====================================================
       15. 副本戰鬥啟動器（借用monsters整包替換的既有慣例，
           結束後完整還原，不影響巡怪系統）
    ===================================================== */

    window.v132ActiveDungeonRun=null;

    function launchDungeonBattle(monsterList,onComplete){
        if(battleActive){
            alert("目前正在戰鬥中，無法開始副本。");
            return false;
        }

        window.v132ActiveDungeonRun={
            previousMonsters:monsters,
            previousZone:currentZone,
            onComplete:onComplete,
            startedAt:Date.now()
        };

        monsters=monsterList;
        currentZone="dungeon";

        battleActive=true;
        battleToken++;
        stopMonsterMovement();
        clearInterval(timerId);
        if(battleAdvanceTimeoutId){
            clearTimeout(battleAdvanceTimeoutId);
            battleAdvanceTimeoutId=null;
        }
        battleAdvanceScheduled=false;
        closeMenus();

        selectedMonster=0;
        turn=1;
        actionReady=false;
        pendingAction=null;

        /*
           V137：副本舊版每次launch（經驗副本三個stage也各算一次）
           都把第二、第三角色補滿，主角卻保留殘血，造成免費補血與
           車輪戰難度失真。比照一般戰鬥，三名角色一律只夾在目前
           上限內，不平白回復HP/SP。
        */
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(!character || !stats){ return; }
            character.hp=Number.isFinite(Number(character.hp))
                ? Math.max(0,Math.min(stats.maxHP,Number(character.hp)))
                : stats.maxHP;
            character.sp=Number.isFinite(Number(character.sp))
                ? Math.max(0,Math.min(stats.maxSP,Number(character.sp)))
                : stats.maxSP;
            character.activeBuffs=[];
            character.statusEffects=[];
            character.isDefending=false;
        });

        currentBattleMonsters=monsterList.map((m,i)=>i);
        currentBattleMonsters.forEach(i=>{
            monsters[i].alive=true;
            monsters[i].hp=monsters[i].maxHP;
            monsters[i].sp=monsters[i].maxSP;
            monsters[i].statusEffects=[];
        });

        renderBattle();
        showPage("battle");

        autoBattle=autoConfig.enabled;
        if(typeof window.v131SyncElementBoxForBattle==="function"){
            window.v131SyncElementBoxForBattle({silent:true});
        }
        syncBattleAutoSettings();
        updateAutoButton();

        selectBattleTarget(0);
        clearBattleLog();
        addBattleLog("副本戰鬥開始！");
        addBattleLog("敵人共有"+currentBattleMonsters.length+"隻。");

        startTurn(battleToken);
        return true;
    }
    window.v132LaunchDungeonBattle=launchDungeonBattle;

    /*
       ★ winBattle()/loseBattle()是既有巡怪系統勝負結算
       的唯一入口，副本借用同一套回合引擎，勝負當然也會
       經過這裡——用window.v132ActiveDungeonRun這個旗標
       判斷「這場是不是副本戰鬥」，是的話整段導去副本
       專屬的結算流程，並且完整還原monsters/currentZone，
       不執行巡怪那一套（重生怪物、回地圖……）。
    */
    function restoreDungeonMonsters(){
        const run=window.v132ActiveDungeonRun;
        if(!run){ return; }
        monsters=run.previousMonsters;
        currentZone=run.previousZone;
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalWinBattle.apply(this,arguments);
            }

            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();

            addBattleLog("副本這一場戰鬥勝利！");

            const turnsUsed=turn;
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            applyPostBattleAutoRecovery();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"win",turnsUsed:turnsUsed});
            }
        };
    }

    if(typeof loseBattle==="function"){
        const originalLoseBattle=loseBattle;
        loseBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalLoseBattle.apply(this,arguments);
            }

            /*
               不呼叫一般loseBattle()：它會排一個2.2秒後返回巡怪地圖的
               timeout。舊版雖然先顯示副本頁，仍會被那個延遲回呼踢回
               地圖。副本失敗在這裡完整收尾並補滿隊伍，再交給副本
               callback回到日常副本頁。
            */
            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();
            addBattleLog("副本挑戰失敗……");
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            getExistingPartyIndexes().forEach(characterIndex=>{
                const character=getPartyCharacterByIndex(characterIndex);
                const stats=getPartyBattleStats(characterIndex);
                if(!character || !stats){ return; }
                character.hp=stats.maxHP;
                character.sp=stats.maxSP;
            });
            updateUI();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"lose"});
            }
        };
    }


    /* =====================================================
       16. 經驗副本：單一角色10級開放，連續3場車輪戰
    ===================================================== */

    function startExpDungeonBattle(stage,rewardExp){
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<10;i++){
            const monster=buildDungeonMonster(
                "經驗軍團兵",
                level,
                randomElement(),
                stage===3 ? "elite" : "regular"
            );
            monster.v141DungeonStage=stage;
            roster.push(monster);
        }
        roster.forEach(monster=>{ setMonsterSkillTier(monster,2,0.5); });

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }

            if(stage<3){
                setTimeout(()=>{
                    startExpDungeonBattle(stage+1,rewardExp);
                },600);
                return;
            }

            showExpDungeonRewardModal(rewardExp);
        });
    }

    /*
       V139經驗副本基礎獎勵固定為「目前全隊升級需求平均值的11%」，
       正式維持「隊伍當級 expNext 平均 ×33%」；看廣告雙倍沿用既有
       流程，因此一般領取約33%、雙倍領取約66%。
    */
    const EXP_DUNGEON_REWARD_RATIO=0.33;

    function getExpDungeonRewardExp(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 0; }
        const total=indexes.reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            if(!character){ return sum; }
            return sum+Math.max(0,Number(character.expNext)||0);
        },0);
        return Math.floor((total/indexes.length)*EXP_DUNGEON_REWARD_RATIO);
    }
    window.v138GetExpDungeonRewardExp=getExpDungeonRewardExp;
    window.v139GetExpDungeonRewardExp=getExpDungeonRewardExp;

    function showExpDungeonRewardModal(rewardExp){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>經驗副本挑戰成功！</h3>'+
            '<p>可獲得經驗值：<b>'+Math.floor(rewardExp).toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    function confirmDungeonEntry(title,details){
        if(typeof window.rpgConfirm!=="function"){
            return Promise.resolve(false);
        }
        return window.rpgConfirm(
            "確定要進入「"+title+"」嗎？\n\n"+
            details+"\n\n"+
            "進入後才會開始戰鬥；挑戰失敗不會扣除今日次數。",
            {
                title:"副本確認",
                confirmText:"進入副本",
                cancelText:"返回"
            }
        );
    }

    window.v132ClaimExpDungeonReward=function(doubled){
        function grant(){
            const rewardMultiplier=doubled ? 2 : 1;
            const rewardExp=Math.floor(getExpDungeonRewardExp()*rewardMultiplier);
            sharedExp+=rewardExp;
            markDungeonUsed("exp");
            addBattleLog("經驗副本結算，獲得"+rewardExp+"EXP，已存入經驗池。");
            saveGame();
            v132CloseRewardModal();
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };

    async function beginExpDungeon(){
        if(!isDungeonAvailable("exp")){
            alert("經驗副本今天已經挑戰過了。");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<10){
            alert("經驗副本需要主角色等級達到10級才能開啟。");
            return;
        }
        if(!await confirmDungeonEntry(
            "經驗副本",
            "將連續進行3場戰鬥，基礎獎勵為目前全隊升級需求平均值的11%。"
        )){
            return;
        }
        const rewardExp=getExpDungeonRewardExp();
        startExpDungeonBattle(1,rewardExp);
    }
    window.v132BeginExpDungeon=beginExpDungeon;


    /* =====================================================
       17. 材料副本：雙角色20級開放，5精英+5普通，寶箱獎勵
    ===================================================== */

    async function beginMaterialDungeon(){
        if(!isDungeonAvailable("material")){
            alert("材料副本今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10CharacterForDailyDungeon()){
            alert("材料副本需要任一角色達到10級才能開啟。");
            return;
        }
        if(!canAddItemToInventory(materialChestDefinition,3)){
            alert("請先預留可放入3個材料寶箱的背包空間，再挑戰材料副本。");
            return;
        }
        if(!await confirmDungeonEntry(
            "材料副本",
            "本場共有10隻怪物；通關後材料寶箱只會放進背包，不會自動開啟。"
        )){
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛",level,randomElement());
            setMonsterSkillTier(monster,2,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            const chestCount=outcome.turnsUsed<5 ? 3 : (outcome.turnsUsed<10 ? 2 : 1);
            showMaterialDungeonRewardModal(chestCount);
        });
    }
    window.v132BeginMaterialDungeon=beginMaterialDungeon;

    /*
       ★ 修正（依照使用者要求，「副本寶箱領取時，不應該直接
       開啟，而是放進包包給玩家自主開起」）：
       原本「材料副本挑戰成功」按「直接領取」就會馬上把寶箱
       全部拆開、材料直接進背包，玩家完全沒有機會自己選時機
       開。改成：領取只把「材料寶箱」這個新物品（可堆疊）
       放進背包，真正的開箱（骰礦石/設計圖階級）延後到玩家
       在背包裡點開這個物品、按下「開啟」的那一刻才進行。
    */
    const CHEST_TIER_WEIGHTS=[
        {key:"white",label:"白階",weight:40},
        {key:"blue",label:"藍階",weight:30},
        {key:"purple",label:"紫階",weight:20},
        {key:"orange",label:"橙階",weight:10}
    ];

    const materialChestDefinition={
        id:"materialChest",
        name:"材料寶箱",
        icon:chestIcon(),
        type:"chest",
        price:0,
        stats:{}
    };

    function syncV17361ItemArt(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return; }
        inventoryItems.forEach(item=>{
            if(!item||!item.id){ return; }
            const ore=oreDefinitions.find(def=>def.id===item.id);
            if(ore){ item.icon=ore.icon; return; }
            if(item.id===materialChestDefinition.id){ item.icon=materialChestDefinition.icon; }
        });
    }
    window.v17361SyncItemArt=syncV17361ItemArt;
    syncV17361ItemArt();

    function hydrateOwnedContentPresentation(){
        hydrateOwnedTicketPresentation();
        hydrateOwnedStaticContentPresentation();
        inventoryItems.forEach(item=>{
            if(item&&item.id===materialChestDefinition.id){
                syncStaticContentPresentation(item,materialChestDefinition);
            }
        });
    }
    window.v132HydrateOwnedContentPresentation=hydrateOwnedContentPresentation;
    hydrateOwnedContentPresentation();

    function pickWeightedTier(){
        const roll=Math.random()*100;
        let acc=0;
        for(const tier of CHEST_TIER_WEIGHTS){
            acc+=tier.weight;
            if(roll<acc){ return tier.key; }
        }
        return CHEST_TIER_WEIGHTS[CHEST_TIER_WEIGHTS.length-1].key;
    }

    /* 骰「開1個材料寶箱」會拿到的內容，純計算、不碰背包。 */
    function rollMaterialChestRewards(){
        const oreTier=pickWeightedTier();
        const oreDef=getOreDefinitionByTier(oreTier);
        const oreAmount=oreTier==="orange" ? 5 : 10;

        const blueprintTier=pickWeightedTier();
        const blueprintPool=getBlueprintDefinitionsByTier(blueprintTier);
        const blueprintDef=blueprintPool[Math.floor(Math.random()*blueprintPool.length)];
        const blueprintAmount=blueprintTier==="orange" ? 5 : 10;

        return [
            {def:oreDef,amount:oreAmount},
            {def:blueprintDef,amount:blueprintAmount}
        ];
    }

    /*
       從背包實際開啟1個材料寶箱：先確認庫存夠、扣掉1個寶箱，
       再骰內容、加進背包。回傳結果字串陣列給呼叫端顯示，
       扣寶箱失敗（沒庫存）回傳null。
    */
    function openSingleMaterialChestFromInventory(){
        const rewards=rollMaterialChestRewards();
        const opened=runInventoryTransaction(()=>{
            if(!consumeStackItem("materialChest",1)){ return false; }
            return rewards.every(r=>addItemToInventory(r.def,r.amount));
        });
        rebuildInventorySlots();
        if(!opened){
            alert("背包空間不足，材料寶箱未消耗。請先整理背包。");
            return null;
        }
        saveGame();
        return rewards.map(r=>r.def.name+"×"+r.amount);
    }
    window.v132OpenMaterialChest=openSingleMaterialChestFromInventory;

    function showMaterialDungeonRewardModal(chestCount){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>材料副本挑戰成功！</h3>'+
            '<p>獲得材料寶箱 ×'+chestCount+'</p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132ClaimMaterialDungeonReward=function(chestCount,doubled){
        function grant(){
            const finalCount=doubled ? chestCount*2 : chestCount;
            const added=addItemToInventory(materialChestDefinition,finalCount);
            rebuildInventorySlots();
            if(!added){
                alert("背包空間不足，材料寶箱尚未領取；請先整理背包後再試。");
                return;
            }
            markDungeonUsed("material");
            saveGame();
            v132CloseRewardModal();
            alert("獲得材料寶箱×"+finalCount+"，請到背包自行開啟。");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };


    /* =====================================================
       18. 裝備副本：雙角色20級開放，1BOSS+4精英，高極裝備寶箱
    ===================================================== */

    function getEquipmentDungeonComposition(){
        const playerCount=Math.max(1,getExistingPartyIndexes().length);
        return {
            playerCount:playerCount,
            bossCount:1,
            eliteCount:4,
            total:5
        };
    }
    window.v138GetEquipmentDungeonComposition=getEquipmentDungeonComposition;

    function buildEquipmentDungeonRoster(){
        const composition=getEquipmentDungeonComposition();
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<composition.bossCount;i++){
            const boss=buildEquipmentDungeonMonster(
                "裝備殿守護者",level,randomElement(),"boss"
            );
            setMonsterMaxTierSkills(boss,0.7);
            lockDungeonSkillConfiguration(boss,3);
            roster.push(boss);
        }
        for(let i=0;i<composition.eliteCount;i++){
            const monster=buildEquipmentDungeonMonster("殿前護衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            lockDungeonSkillConfiguration(monster,2);
            roster.push(monster);
        }
        return roster;
    }
    window.v132BuildEquipmentDungeonRoster=buildEquipmentDungeonRoster;

    async function beginEquipmentDungeon(){
        if(!isDungeonAvailable("equipment")){
            alert("裝備副本今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10CharacterForDailyDungeon()){
            alert("裝備副本需要任一角色達到10級才能開啟。");
            return;
        }
        if(!ticketDefinitions.some(definition=>canAddItemToInventory(definition,1))){
            alert("請先預留至少1張裝備抽獎券的背包空間，再挑戰裝備副本。");
            return;
        }

        const composition=getEquipmentDungeonComposition();
        if(!await confirmDungeonEntry(
            "裝備副本",
            "固定編成：1隻BOSS與4隻精英怪，共5名敵人。"
        )){
            return;
        }

        const roster=buildEquipmentDungeonRoster();

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            showEquipmentDungeonRewardModal();
        });
    }
    window.v132BeginEquipmentDungeon=beginEquipmentDungeon;

    function showEquipmentDungeonRewardModal(){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>裝備副本挑戰成功！</h3>'+
            '<p>獲得高極裝備寶箱 ×1，請選擇1張抽獎券：</p>'+
            '<div class="v132-ticket-choices">'+
            ticketDefinitions.map(def=>
                '<button type="button" class="v132-ticket-choice" onclick="v132ClaimEquipmentDungeonReward(\''+def.id+'\',false)">'+
                '<span class="v132-ticket-icon">'+def.icon+'</span>'+
                '<span class="v132-ticket-name">'+def.name+'</span>'+
                '</button>'
            ).join("")+
            '</div>'+
            '<div class="v132-reward-actions">'+
            '<span class="v132-reward-note">選好之後可再選擇是否看廣告雙倍領取（雙倍＝同款抽獎券×2）</span>'+
            '<button type="button" class="v132-reward-back" onclick="v132LeaveEquipmentReward()">返回</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132LeaveEquipmentReward=function(){
        v132CloseRewardModal();
        showPage("dungeon");
        switchDungeonTab("daily");
    };

    window.v132ClaimEquipmentDungeonReward=async function(ticketId,doubled){
        function grant(amount){
            const definition=getTicketDefinition(ticketId);
            if(!definition){ return; }
            if(!addItemToInventory(definition,amount)){
                rebuildInventorySlots();
                alert("背包空間不足，抽獎券尚未領取；請先整理背包後再試。");
                return;
            }
            rebuildInventorySlots();
            markDungeonUsed("equipment");
            saveGame();
            v132CloseRewardModal();
            alert("獲得"+definition.name+"×"+amount+"！");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            grant(2);
            return;
        }

        if(!doubled){
            const askDouble=
                typeof window.rpgConfirm==="function" &&
                await window.rpgConfirm(
                    "要看廣告雙倍領取這張抽獎券嗎？",
                    {
                        title:"裝備副本獎勵",
                        confirmText:"觀看廣告雙倍",
                        cancelText:"直接領取"
                    }
                );
            if(askDouble){
                showRewardedAd(function(){ grant(2); },function(){
                    alert("廣告未完成，改為直接領取。");
                    grant(1);
                });
                return;
            }
        }
        grant(1);
    };


    /* =====================================================
       19. 通用獎勵彈窗（簡單覆蓋層，跟遊戲既有深色系一致）
    ===================================================== */

    function ensureRewardModalElement(){
        let modal=document.getElementById("v132RewardModal");
        if(modal){ return modal; }
        modal=document.createElement("div");
        modal.id="v132RewardModal";
        modal.className="v132-reward-modal";
        document.body.appendChild(modal);
        return modal;
    }

    window.v132ShowRewardModal=function(innerHtml){
        const modal=ensureRewardModalElement();
        modal.innerHTML=innerHtml;
        modal.classList.add("show");
    };

    window.v132CloseRewardModal=function(){
        const modal=document.getElementById("v132RewardModal");
        if(modal){ modal.classList.remove("show"); }
    };


    /* =====================================================
       20. 日常副本頁面內容（接進既有renderDungeonTabContent
           的「日常副本尚未設計完成」空殼）
    ===================================================== */

    function dungeonEntryCard(type,title,requirement,rewardPreview,onClick){
        /* ★ 改用isDungeonUsedToday()，這樣每日次數旗標關閉時，
           畫面也一定跟著顯示「可挑戰」，不會出現「按鈕是灰的、
           但其實邏輯允許挑戰」這種自相矛盾的狀態。 */
        const used=isDungeonUsedToday(type);
        return (
            '<div class="v132-dungeon-card">'+
            '<div class="v132-dungeon-card-title">'+title+
            (used ? '<span class="v132-dungeon-done">今日已完成</span>' : '')+
            '</div>'+
            '<div class="v132-dungeon-card-req">開放條件：'+requirement+'</div>'+
            '<div class="v132-dungeon-card-reward">獎勵：'+rewardPreview+'</div>'+
            '<button type="button" class="v132-dungeon-enter-btn" '+
            (used ? "disabled" : 'onclick="'+onClick+'()"')+
            '>'+(used ? "今日已挑戰" : "挑戰")+'</button>'+
            '</div>'
        );
    }

    function renderDailyDungeonList(){
        return (
            '<div class="v132-dungeon-list">'+
            dungeonEntryCard(
                "exp","經驗副本","單一角色達到10級",
                "全隊升下一級所需總經驗平均值的11%（廣告可雙倍）","v132BeginExpDungeon"
            )+
            dungeonEntryCard(
                "material","材料副本","任一角色達到10級",
                "材料寶箱×1～3（依通關回合數）","v132BeginMaterialDungeon"
            )+
            dungeonEntryCard(
                "equipment","裝備副本","任一角色達到10級",
                "高極裝備寶箱×1（自選抽獎券）","v132BeginEquipmentDungeon"
            )+
            '<div style="font-size:11px;color:#7a6f5c;margin-top:6px;">'+
            (DUNGEON_DAILY_LIMIT_ENABLED
                ? '每個副本每日只能挑戰1次，挑戰失敗不會扣除次數，'+
                  '領取獎勵之後才會計入今日已完成。'
                : '⚙️ 測試模式：每日挑戰次數限制目前為關閉狀態，'+
                  '所有副本都可以無限次重複挑戰。')+
            '</div>'+
            '</div>'
        );
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return renderDailyDungeonList();
            }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }

})();


/* bundled source: js/28-v133-economy-rebalance.js */
/*
   V133 — 經濟／養成重新設計 owner
   EXP仍只進既有 sharedExp／角色 exp；自然充能只保存時間戳與解鎖狀態。
*/
(function installV133EconomyRebalance(){
    "use strict";

    const MAX_CHARACTER_LEVEL=100;
    const TRAINING_EXP_MULTIPLIER=3.5;
    const DAY_MS=24*60*60*1000;
    const CHARGE_MAX_MS=72*60*60*1000;
    const GROWTH_STATE_KEY=window.FourSymbolsAccountSave.accountKey("exp-pool-growth-state");

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
    const TARGET_BATTLE_ANCHORS=[
        {level:1,battles:3},{level:10,battles:15},{level:20,battles:45},
        {level:30,battles:100},{level:40,battles:250},{level:50,battles:400},
        {level:60,battles:650},{level:70,battles:900},{level:80,battles:1200},
        {level:90,battles:1700},{level:95,battles:2600},{level:98,battles:3500},
        {level:99,battles:4000}
    ];

    /* Lv1→20 快速期維持既有靜態需求；從 Lv20→21 起，expNext 唯一依據
       為「該級練功區正式平均戰鬥 EXP × TARGET_BATTLE_ANCHORS」。 */
    const NEWCOMER_EXP_REQUIREMENT_ANCHORS=[
        {level:1,value:300},{level:5,value:600},{level:10,value:1200},
        {level:15,value:2500},{level:20,value:8000}
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
    /* 這三筆只在帳號第一次、且尚未Lv20時各領一次，讓新手內容而非
       重複農怪承擔約6,000 EXP；其餘仍由正常戰鬥／原任務獎勵補足。 */
    const NEWCOMER_DAILY_BONUSES={win3:2000,skills5:1500,kill10:2500};

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
        const safeLevel=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        return TRAINING_ZONE_EXP_PROFILES.find(profile=>safeLevel>=profile.minLevel&&safeLevel<=profile.maxLevel)||TRAINING_ZONE_EXP_PROFILES[9];
    }
    function getTrainingZoneRoster(profile){
        try{
            if(typeof zoneConfig==="undefined"||!zoneConfig[profile.key]){ return null; }
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function"?source():source;
            return Array.isArray(roster)&&roster.length?roster:null;
        }catch(_){ return null; }
    }
    function getTrainingZoneAverageExpForLevel(level){
        const profile=getTrainingExpProfile(level);
        const roster=getTrainingZoneRoster(profile);
        if(!roster){ return profile.fallbackAverageExp; }
        const average=roster.reduce((sum,monster)=>{
            if(!monster){ return sum; }
            return sum+Math.max(1,Number(monster.level)||1)*10*getCurveMonsterRankMultiplier(monster);
        },0)/roster.length;
        return Math.max(1,Math.round(average*profile.averageGroupSize*TRAINING_EXP_MULTIPLIER));
    }
    function getTargetBattlesForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        if(safe<=TARGET_BATTLE_ANCHORS[0].level){ return TARGET_BATTLE_ANCHORS[0].battles; }
        for(let i=1;i<TARGET_BATTLE_ANCHORS.length;i++){
            const right=TARGET_BATTLE_ANCHORS[i];
            if(safe>right.level){ continue; }
            const left=TARGET_BATTLE_ANCHORS[i-1];
            const t=(safe-left.level)/(right.level-left.level);
            return Math.max(1,Math.round(left.battles+(right.battles-left.battles)*t));
        }
        return TARGET_BATTLE_ANCHORS[TARGET_BATTLE_ANCHORS.length-1].battles;
    }
    function getExpNextForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        if(safe<20){
            return Math.max(1,Math.round(interpolateAnchors(safe,NEWCOMER_EXP_REQUIREMENT_ANCHORS)));
        }
        const averageBattleExp=getTrainingZoneAverageExpForLevel(safe);
        const targetBattles=getTargetBattlesForLevel(safe);
        return Math.max(1,Math.round(averageBattleExp*targetBattles));
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
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,NATURAL_CHARGE_LEVELS_PER_DAY));
    }
    function getDailyQuestLevelsPerDay(level){
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,DAILY_QUEST_LEVELS_PER_DAY));
    }
    function getDailyTotalTarget(level){
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,DAILY_TOTAL_TARGETS));
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
    function getCharacterPartyIndex(character){
        if(!character){ return -1; }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const index=getExistingPartyIndexes().slice(0,3).find(value=>getPartyCharacterByIndex(value)===character);
            if(Number.isInteger(index)){ return index; }
        }
        if(typeof player2!=="undefined"&&character===player2){ return 1; }
        if(typeof player3!=="undefined"&&character===player3){ return 2; }
        if(typeof player!=="undefined"&&character===player){ return 0; }
        return -1;
    }
    function getAdditionalCharacterPoolMultiplier(character,level){
        const safeLevel=Math.max(1,Number(level)||Number(character&&character.level)||1);
        if(safeLevel>=20){ return 1; }
        const index=getCharacterPartyIndex(character);
        if(index===2){ return 2.00; }
        if(index===1){ return 1.50; }
        return 1;
    }
    function getExpPoolCatchUpMultiplierAtLevel(character,level){
        const slotMultiplier=getAdditionalCharacterPoolMultiplier(character,level);
        if(slotMultiplier>1){ return slotMultiplier; }
        return getExpPoolCatchUpMultiplierForLevel(level);
    }
    function getExpPoolCatchUpMultiplier(character){
        return getExpPoolCatchUpMultiplierAtLevel(character,character&&character.level);
    }
    function getDirectCatchUpExpMultiplier(character){
        if(!character||(Number(character.level)||1)>=20){ return 1; }
        const index=getCharacterPartyIndex(character);
        if(index===2){ return 3; }
        if(index===1){ return 2; }
        return 1;
    }
    window.v173GetExpPoolCatchUpMultiplierForLevel=getExpPoolCatchUpMultiplierForLevel;
    window.v173GetExpPoolCatchUpMultiplier=getExpPoolCatchUpMultiplier;
    window.v173GetDirectCatchUpExpMultiplier=getDirectCatchUpExpMultiplier;

    function loadGrowthState(){
        try{
            const raw=JSON.parse(localStorage.getItem(GROWTH_STATE_KEY)||"{}");
            return {
                initialized:raw.initialized===true,
                unlocked:raw.unlocked===true,
                lastAt:Number.isFinite(Number(raw.lastAt))?Math.max(0,Number(raw.lastAt)):0,
                noticeShown:raw.noticeShown===true,
                lastCapped:raw.lastCapped===true,
                newcomerRewards:raw.newcomerRewards&&typeof raw.newcomerRewards==="object"?Object.assign({},raw.newcomerRewards):{}
            };
        }catch(_){
            return {initialized:false,unlocked:false,lastAt:0,noticeShown:false,lastCapped:false,newcomerRewards:{}};
        }
    }
    const growthState=loadGrowthState();
    function persistGrowthState(){
        try{ localStorage.setItem(GROWTH_STATE_KEY,JSON.stringify(growthState)); }catch(_){ }
    }
    function resetGrowthStateForNoCharacter(){
        growthState.initialized=false;
        growthState.unlocked=false;
        growthState.lastAt=0;
        growthState.noticeShown=false;
        growthState.lastCapped=false;
        growthState.newcomerRewards={};
        persistGrowthState();
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
        if(!hasCharacter){
            if(growthState.initialized||growthState.unlocked||growthState.lastAt>0){ resetGrowthStateForNoCharacter(); }
            return false;
        }
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
        const highest=getHighestCreatedCharacterLevel();
        if(!growthState.initialized||!growthState.unlocked||highest<20||!hasNonMaxCharacter()){
            return {gain:0,elapsedMs:0,capped:false,levelsPerDay:0,referenceLevel:highest};
        }
        const rawElapsed=timestamp>=growthState.lastAt?timestamp-growthState.lastAt:0;
        const elapsed=Math.min(CHARGE_MAX_MS,Math.max(0,rawElapsed));
        const referenceLevel=Math.min(99,Math.max(20,highest));
        const levelsPerDay=getNaturalChargeLevelsPerDay(referenceLevel);
        const gain=Math.max(0,Math.floor(getExpNextForLevel(referenceLevel)*levelsPerDay*(elapsed/DAY_MS)));
        return {gain:gain,elapsedMs:elapsed,capped:rawElapsed>=CHARGE_MAX_MS,levelsPerDay:levelsPerDay,referenceLevel:referenceLevel};
    }
    window.v173PreviewExpPoolCharge=getChargePreview;

    function getAvailableExpPool(now){
        return Math.max(0,Number(typeof sharedExp!=="undefined"?sharedExp:0)||0)+getChargePreview(now).gain;
    }
    window.v173GetAvailableExpPool=getAvailableExpPool;

    function settleExpPoolCharge(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const wasInitialized=growthState.initialized;
        if(!ensureExpPoolChargeUnlocked(timestamp,false)){ return 0; }
        if(!wasInitialized){ return 0; }
        /* 裝置時間倒退時只拒絕這段時間，不把權威基準往回移；否則先
           倒退再調回正確時間會再次產生同一段自然充能。 */
        if(timestamp<growthState.lastAt){
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
            initialized:growthState.initialized,unlocked:growthState.unlocked,lastAt:growthState.lastAt,
            noticeShown:growthState.noticeShown,lastCapped:growthState.lastCapped,maxHours:72
        };
    };

    function getDailyGrowthRewardBreakdown(level){
        const raw=Number(level)||getHighestCreatedCharacterLevel();
        if(raw<20){ return {totalExp:0,taskExp:0,chestExp:0,levelsPerDay:0}; }
        const referenceLevel=Math.min(99,Math.max(20,Math.floor(raw)));
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

    /* Late UI/reward bridge: V131 preview and V141 quest UI are loaded after this
       economy owner. It installs once when those existing owners become ready. */
    const lateState={
        installed:false,previewWrapped:false,chestWrapped:false,
        rewardBases:new WeakMap(),visualGain:null,attempts:0
    };

    function discountedPreviewCost(character,count){
        if(!character||count<=0){ return 0; }
        let level=Math.max(1,Math.floor(Number(character.level)||1));
        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||getExpNextForLevel(level));
        let total=0;
        for(let i=0;i<count&&level<MAX_CHARACTER_LEVEL;i++){
            const need=Math.max(1,expNext-exp);
            total+=Math.ceil(need/getExpPoolCatchUpMultiplierAtLevel(character,level));
            level++;
            exp=0;
            expNext=getExpNextForLevel(level);
        }
        return total;
    }
    window.v173GetDiscountedPreviewCost=discountedPreviewCost;

    function readPreviewCounts(){
        const counts={0:0,1:0,2:0};
        const container=typeof document!=="undefined"?document.getElementById("expDistributeList"):null;
        if(!container||typeof getExistingPartyIndexes!=="function"){ return counts; }
        const rows=Array.from(container.querySelectorAll(".v131-exp-row"));
        getExistingPartyIndexes().slice(0,3).forEach((index,position)=>{
            const character=getPartyCharacterByIndex(index);
            const text=rows[position]&&rows[position].querySelector(".v131-exp-level")?.textContent||"";
            const match=text.match(/→\s*Lv\.(\d+)/);
            const target=match?Number(match[1]):Number(character&&character.level)||1;
            counts[index]=Math.max(0,target-(Number(character&&character.level)||1));
        });
        return counts;
    }
    function totalDiscountedPreviewCost(counts){
        if(typeof getExistingPartyIndexes!=="function"){ return 0; }
        return getExistingPartyIndexes().slice(0,3).reduce((sum,index)=>
            sum+discountedPreviewCost(getPartyCharacterByIndex(index),Math.max(0,Number(counts[index])||0)),0
        );
    }

    function decorateExpPoolDistributionUi(){
        if(typeof document==="undefined"||typeof getExistingPartyIndexes!=="function"){ return; }
        const container=document.getElementById("expDistributeList");
        if(!container){ return; }
        const indexes=getExistingPartyIndexes().slice(0,3);
        const rows=Array.from(container.querySelectorAll(".v131-exp-row"));
        const counts=readPreviewCounts();
        indexes.forEach((index,position)=>{
            const row=rows[position];
            const character=getPartyCharacterByIndex(index);
            if(!row||!character){ return; }
            let meta=row.querySelector(".v173-exp-row-meta");
            if(!meta){
                meta=document.createElement("div");
                meta.className="v173-exp-row-meta";
                const levelNode=row.querySelector(".v131-exp-level");
                (levelNode||row.firstChild)?.insertAdjacentElement?.("afterend",meta);
                if(!meta.parentNode){ row.appendChild(meta); }
            }
            const multiplier=getExpPoolCatchUpMultiplier(character);
            const currentExp=Math.max(0,Math.floor(Number(character.exp)||0));
            const next=Math.max(1,Math.floor(Number(character.expNext)||getExpNextForLevel(character.level)));
            meta.innerHTML="目前 "+currentExp.toLocaleString("zh-TW")+" / "+next.toLocaleString("zh-TW")+" EXP"+
                (multiplier>1?'<b>追趕加成 ×'+multiplier.toFixed(2)+"</b>":"");

            const previewButton=row.querySelector(".v131-exp-preview-btn");
            if(previewButton){
                const candidate=Object.assign({},counts);
                candidate[index]=(candidate[index]||0)+1;
                const can=(Number(character.level)||1)+(counts[index]||0)<MAX_CHARACTER_LEVEL&&
                    totalDiscountedPreviewCost(candidate)<=getAvailableExpPool(Date.now());
                previewButton.disabled=!can;
            }
        });
        const summary=container.querySelector(".v131-exp-preview-summary");
        if(summary){
            const cost=totalDiscountedPreviewCost(counts);
            summary.textContent="本次分配："+cost.toLocaleString("zh-TW")+" EXP";
        }
        if(typeof window.v146SyncCharacterAttentionDots==="function"){
            window.v146SyncCharacterAttentionDots();
        }
    }
    window.v173DecorateExpPoolDistributionUi=decorateExpPoolDistributionUi;

    function v173CaptureExpPoolViewport(){
        if(typeof document==="undefined"){ return null; }
        const scroller=document.getElementById("characterTabContent");
        if(!scroller){ return null; }
        return {
            scroller,
            top:Math.max(0,Number(scroller.scrollTop)||0),
            left:Math.max(0,Number(scroller.scrollLeft)||0)
        };
    }
    function v173RestoreExpPoolViewport(snapshot){
        if(!snapshot||!snapshot.scroller){ return; }
        const restore=function(){
            const scroller=snapshot.scroller;
            if(!scroller||scroller.isConnected===false){ return; }
            scroller.scrollTop=snapshot.top;
            scroller.scrollLeft=snapshot.left;
        };
        restore();
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(function(){
                restore();
                requestAnimationFrame(restore);
            });
        }else if(typeof setTimeout==="function"){
            setTimeout(restore,0);
        }
    }
    function v173BlurExpPoolAction(){
        if(typeof document==="undefined"){ return; }
        const active=document.activeElement;
        if(active&&typeof active.blur==="function"&&active.matches&&
            active.matches("#homeExpPoolCard .v131-exp-preview-btn, #homeExpPoolCard .v131-exp-confirm, #homeExpPoolCard .v131-exp-back")){
            active.blur();
        }
    }
    function v173ScheduleExpPoolDecoration(snapshot){
        v173RestoreExpPoolViewport(snapshot);
        const finish=function(){
            decorateExpPoolDistributionUi();
            v173RestoreExpPoolViewport(snapshot);
        };
        if(typeof setTimeout==="function"){ setTimeout(finish,0); }
        else{ finish(); }
    }

    function wrapExpPreviewForCatchUp(){
        if(lateState.previewWrapped||typeof window.v131PreviewExpLevel!=="function"||typeof window.v131ConfirmExpPreview!=="function"){ return; }
        lateState.previewWrapped=true;
        const previousPreview=window.v131PreviewExpLevel;
        const previousConfirm=window.v131ConfirmExpPreview;
        const previousCancel=window.v131CancelExpPreview;
        window.v131PreviewExpLevel=function(index){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const candidate=Object.assign({},counts);
            candidate[index]=(candidate[index]||0)+1;
            const discounted=totalDiscountedPreviewCost(candidate);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted>actual){
                alert("經驗池不足，還需要 "+(discounted-actual).toLocaleString("zh-TW")+" EXP。");
                return false;
            }
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{ return previousPreview.apply(this,arguments); }
            finally{
                sharedExp=actual;
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        window.v131ConfirmExpPreview=async function(){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const discounted=totalDiscountedPreviewCost(counts);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted<=0||discounted>actual){
                if(discounted>actual){ alert("經驗池不足，無法完成本次分配。"); }
                return false;
            }
            const levelCount=Object.values(counts).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
            const confirmMessage="確定要消耗 "+discounted.toLocaleString("zh-TW")+" EXP，完成 "+levelCount+" 次升級嗎？";
            if(typeof window.rpgConfirm!=="function"){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            const approved=await window.rpgConfirm(confirmMessage,{
                title:"確認經驗池升級",
                confirmText:"確定升級",
                cancelText:"返回"
            });
            if(!approved){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            let completed=false;
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{
                const result=previousConfirm.apply(this,arguments);
                completed=true;
                return result;
            }finally{
                sharedExp=completed?Math.max(0,actual-discounted):actual;
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        if(typeof previousCancel==="function"){
            window.v131CancelExpPreview=function(){
                const viewport=v173CaptureExpPoolViewport();
                v173BlurExpPoolAction();
                try{ return previousCancel.apply(this,arguments); }
                finally{ v173ScheduleExpPoolDecoration(viewport); }
            };
        }
    }

    function syncDailyQuestGrowthRewards(){
        if(typeof dailyQuestDefinitions==="undefined"||!Array.isArray(dailyQuestDefinitions)||!window.v141UpdateNotificationDots){ return; }
        const breakdown=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel());
        const quests=dailyQuestDefinitions.filter(quest=>quest&&quest.reward&&typeof quest.reward==="object");
        if(!quests.length){ return; }
        const each=Math.floor(breakdown.taskExp/quests.length);
        let remainder=breakdown.taskExp-each*quests.length;
        quests.forEach(quest=>{
            const reward=quest.reward;
            if(!lateState.rewardBases.has(reward)){
                lateState.rewardBases.set(reward,Math.max(0,Number(reward.exp)||0));
            }
            const extra=each+(remainder>0?1:0);
            if(remainder>0){ remainder--; }
            reward.exp=lateState.rewardBases.get(reward)+extra;
        });
    }
    window.v173SyncDailyQuestGrowthRewards=syncDailyQuestGrowthRewards;

    function wrapDailyFinalChestBonus(){
        if(lateState.chestWrapped||typeof window.v141ClaimQuestMilestone!=="function"){ return; }
        lateState.chestWrapped=true;
        const previous=window.v141ClaimQuestMilestone;
        window.v141ClaimQuestMilestone=function(type,threshold){
            const before=Math.max(0,Number(sharedExp)||0);
            const result=previous.apply(this,arguments);
            if(type==="daily"&&Number(threshold)===100&&Math.max(0,Number(sharedExp)||0)>before&&getHighestCreatedCharacterLevel()>=20){
                const bonus=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel()).chestExp;
                if(bonus>0){
                    sharedExp+=bonus;
                    if(typeof updateUI==="function"){ updateUI(); }
                    if(typeof saveGame==="function"){ saveGame(); }
                    if(typeof window.v141ShowBlackGoldReward==="function"){
                        window.v141ShowBlackGoldReward({exp:bonus,gold:0,items:[]});
                    }
                }
            }
            return result;
        };
    }

    function ensureChargeUi(){
        if(typeof document==="undefined"){ return null; }
        const card=document.getElementById("homeExpPoolCard");
        if(!card){ return null; }
        let panel=document.getElementById("v173ExpPoolChargeStatus");
        if(!panel){
            panel=document.createElement("section");
            panel.id="v173ExpPoolChargeStatus";
            panel.className="v173-exp-charge-status";
            panel.innerHTML='<div><b id="v173ExpChargeTitle"></b><span id="v173ExpChargeRate"></span></div>'+
                '<small id="v173ExpChargeText"></small><div class="v173-exp-charge-floats" aria-hidden="true"></div>';
            const hero=card.querySelector(".exp-pool-hero");
            if(hero){ hero.insertAdjacentElement("afterend",panel); }
            else{ card.insertBefore(panel,card.firstChild||null); }
        }
        return panel;
    }

    function syncChargeUi(animate){
        const panel=ensureChargeUi();
        const card=typeof document!=="undefined"?document.getElementById("homeExpPoolCard"):null;
        if(!panel||!card||card.style.display==="none"){ lateState.visualGain=null; return; }
        const state=window.v173GetExpPoolChargeState();
        const title=document.getElementById("v173ExpChargeTitle");
        const rate=document.getElementById("v173ExpChargeRate");
        const text=document.getElementById("v173ExpChargeText");
        const highest=getHighestCreatedCharacterLevel();
        if(highest<20||!state.unlocked){
            if(title){ title.textContent="Lv20 解鎖持續充能"; }
            if(rate){ rate.textContent="未啟動"; }
            if(text){ text.textContent="達到 Lv20 後，即使離線也會持續累積經驗池。"; }
            lateState.visualGain=null;
            return;
        }
        const preview=getChargePreview(Date.now());
        if(title){ title.textContent=preview.capped?"充能已滿":"持續充能中"; }
        if(rate){ rate.textContent="約 "+Math.round(preview.levelsPerDay*100)+"% 等級進度／日"; }
        if(text){ text.textContent="自然充能最多累積 72 小時；在線、離線都會計算。"; }
        const value=document.getElementById("sharedExpValue");
        if(value){ value.textContent=Math.floor((Number(sharedExp)||0)+preview.gain).toLocaleString("zh-TW"); }
        if(animate&&lateState.visualGain!==null&&preview.gain>lateState.visualGain){
            const delta=preview.gain-lateState.visualGain;
            const layer=panel.querySelector(".v173-exp-charge-floats");
            if(layer&&delta>0){
                const float=document.createElement("span");
                float.className="v173-exp-charge-float";
                float.textContent="+"+delta.toLocaleString("zh-TW")+" EXP";
                layer.appendChild(float);
                if(typeof setTimeout==="function"){ setTimeout(()=>float.remove(),1500); }
            }
        }
        lateState.visualGain=preview.gain;
    }
    window.v173SyncExpPoolChargeUi=syncChargeUi;

    function decorateDailyFinalChest(){
        if(typeof document==="undefined"){ return; }
        const daily=document.getElementById("questTabBtnDaily");
        if(!daily||daily.getAttribute("aria-selected")!=="true"){ return; }
        const bonus=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel()).chestExp;
        document.querySelectorAll("#homeFeatureModal .quest-milestone").forEach(node=>{
            if(node.querySelector(".quest-milestone-percent")?.textContent?.trim()!=="100%"){ return; }
            const small=node.querySelector("small");
            if(!small){ return; }
            if(!small.dataset.v173BaseLabel){ small.dataset.v173BaseLabel=small.textContent||""; }
            small.textContent=small.dataset.v173BaseLabel+(bonus>0?"＋"+bonus.toLocaleString("zh-TW")+"EXP":" ");
        });
    }

    function installLateGrowthEnhancements(){
        if(lateState.installed){ return; }
        const ready=typeof window.v131PreviewExpLevel==="function"&&
            typeof window.v141ClaimQuestMilestone==="function"&&
            typeof window.v141UpdateNotificationDots==="function";
        if(!ready){
            lateState.attempts++;
            if(lateState.attempts<200&&typeof setTimeout==="function"){ setTimeout(installLateGrowthEnhancements,50); }
            return;
        }
        lateState.installed=true;
        wrapExpPreviewForCatchUp();
        wrapDailyFinalChestBonus();
        syncDailyQuestGrowthRewards();
        decorateExpPoolDistributionUi();
        syncChargeUi(false);
        decorateDailyFinalChest();
        /* 4秒 timer 只重繪／計算畫面，從不直接增加 sharedExp。 */
        if(typeof setInterval==="function"){
            setInterval(()=>{
                syncDailyQuestGrowthRewards();
                decorateExpPoolDistributionUi();
                syncChargeUi(true);
                decorateDailyFinalChest();
            },4000);
        }
    }

    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,20,30,40,49,50,60,70,80,90,95,98,99].map(level=>{
            const averageBattleExp=getTrainingZoneAverageExpForLevel(level);
            const targetBattles=getTargetBattlesForLevel(level);
            const expNext=getExpNextForLevel(level);
            const theoreticalBattles=averageBattleExp>0?expNext/averageBattleExp:0;
            const differencePercent=targetBattles>0?((theoreticalBattles-targetBattles)/targetBattles)*100:0;
            return {
                level:level,averageBattleExp:averageBattleExp,targetBattles:targetBattles,expNext:expNext,
                theoreticalBattles:theoreticalBattles,differencePercent:differencePercent,
                naturalLevelsPerDay:getNaturalChargeLevelsPerDay(level),dailyQuestLevelsPerDay:getDailyQuestLevelsPerDay(level),
                dailyTotalTarget:getDailyTotalTarget(level)
            };
        });
        let totalEffectiveBattles=0;
        for(let level=1;level<MAX_CHARACTER_LEVEL;level++){ totalEffectiveBattles+=getTargetBattlesForLevel(level); }
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
        return {totalExpTo20:total,requirements:requirements,newcomerOneTimeExp:6000};
    };

    function recalibrateCharacterExpNext(character){
        if(!character){ return; }
        character.level=Math.min(MAX_CHARACTER_LEVEL,Math.max(1,Math.floor(Number(character.level)||1)));
        if(character.level>=MAX_CHARACTER_LEVEL){ character.exp=0; }
        character.expNext=getExpNextForLevel(character.level);
    }


    function grantDirectCatchUpExp(character,baseExp){
        if(!character||(Number(character.level)||1)>=MAX_CHARACTER_LEVEL){ return {baseExp:0,multiplier:1,grantedExp:0}; }
        const raw=Math.max(0,Math.floor(Number(baseExp)||0));
        const multiplier=getDirectCatchUpExpMultiplier(character);
        const granted=Math.max(0,Math.floor(raw*multiplier));
        if(granted<=0){ return {baseExp:raw,multiplier:multiplier,grantedExp:0}; }
        character.exp=Math.max(0,Number(character.exp)||0)+granted;
        let guard=0;
        while((Number(character.level)||1)<MAX_CHARACTER_LEVEL&&character.exp>=Math.max(1,Number(character.expNext)||getExpNextForLevel(character.level))&&guard<100){
            const before=Number(character.level)||1;
            if(typeof checkLevelUp==="function"){ checkLevelUp(character); }
            else{
                character.exp-=Math.max(1,Number(character.expNext)||getExpNextForLevel(character.level));
                character.level++;
                recalibrateCharacterExpNext(character);
            }
            if((Number(character.level)||1)===before){ break; }
            guard++;
        }
        if(typeof refreshCharacterAvatarLevels==="function"){ refreshCharacterAvatarLevels(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        return {baseExp:raw,multiplier:multiplier,grantedExp:granted};
    }
    window.v173GrantCharacterCatchUpExp=grantDirectCatchUpExp;

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
            const character=slotNumber===3?player3:player2;
            recalibrateCharacterExpNext(character);
            ensureExpPoolChargeUnlocked(Date.now(),false);
            if(typeof updateUI==="function"){ updateUI(); }
            if(typeof saveGame==="function"){ saveGame(); }
            return result;
        };
    }
    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ settleExpPoolCharge(Date.now()); } });
    }
    if(typeof window!=="undefined"&&typeof window.addEventListener==="function"){
        window.addEventListener("pageshow",()=>settleExpPoolCharge(Date.now()));
    }
    if(typeof renderExpDistributeList==="function"){ renderExpDistributeList(); }
    if(typeof setTimeout==="function"){ setTimeout(installLateGrowthEnhancements,0); }

    /* 2. 怪物金幣掉落rank倍率 */
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

    /* 3. 商店價格 */
    const SHOP_PRICE_TIERS=[
        {maxLevel:30,multiplier:1,label:"Lv.1～30"},{maxLevel:40,multiplier:1.5,label:"Lv.31～40"},
        {maxLevel:50,multiplier:2,label:"Lv.41～50"},{maxLevel:60,multiplier:2.5,label:"Lv.51～60"},
        {maxLevel:70,multiplier:3,label:"Lv.61～70"},{maxLevel:80,multiplier:3.5,label:"Lv.71～80"},
        {maxLevel:90,multiplier:4,label:"Lv.81～90"},{maxLevel:100,multiplier:4.5,label:"Lv.91～100"}
    ];
    function getShopPriceTier(){
        const highestLevel=getHighestCreatedCharacterLevel();
        for(const tier of SHOP_PRICE_TIERS){ if(highestLevel<=tier.maxLevel){ return tier; } }
        return SHOP_PRICE_TIERS[SHOP_PRICE_TIERS.length-1];
    }
    function getShopItemPrice(shopItem){
        if(!shopItem||!Number.isFinite(shopItem.price)){ return shopItem?shopItem.price:null; }
        return Math.round(shopItem.price*getShopPriceTier().multiplier);
    }
    window.v133GetShopItemPrice=getShopItemPrice;

    /* 4. 藥水補品 */
    const SHOP_POTION_BASE_PRICES={hpPotion10:20,hpPotion30:50,hpPotion50:80,spPotion10:25,spPotion30:65,spPotion50:100};
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
        return SHOP_POTION_IDS.map(id=>potionDefinitions.find(item=>item&&item.id===id)).filter(Boolean);
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
                return `<div class="shop-potion-card ${shopItem.resource}">
                    <div class="shop-potion-card-head"><span class="shop-potion-type">${resourceLabel}</span><span class="shop-potion-stock">持有 ${count}</span></div>
                    <div class="shop-potion-name">${shopItem.name}</div><div class="shop-potion-effect">${effectText}</div>
                    <div class="shop-potion-purchase-row"><label for="shopQuantity-${shopItem.id}">數量</label>
                    <input id="shopQuantity-${shopItem.id}" class="shop-potion-quantity" type="number" inputmode="numeric" min="1" max="9999" step="1" value="1">
                    <button class="home-feature-buy-btn shop-potion-buy" ${disabled?"disabled":""} onclick="buyShopItem('${shopItem.id}',document.getElementById('shopQuantity-${shopItem.id}').value)">${buttonText}</button></div></div>`;
            }).join("");
            return `<div class="shop-potion-interface"><div class="shop-potion-note">只販售 HP／SP 回復藥水</div>
                <div class="v133-shop-tier-note">目前商店階級：${tier.label}（價格×${tier.multiplier}）</div><div class="shop-potion-list">${cards}</div></div>`;
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
            gold-=totalPrice;
            rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            const bodyEl=$("homeFeatureModalBody");
            if(bodyEl){ bodyEl.innerHTML=renderShopContent(); }
        };
    }

    /* 5. 共用金幣消耗工具 */
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


/* bundled source: js/29-v134-fixes.js */
/*
   V134 — 三個回報問題的修正：
   1. 戰鬥「空拍很久」：輪到手動角色時指令列沒顯示，玩家看不到按鈕、
      只能乾等 20 秒倒數跑完
   2. 自動戰鬥「設定出招了還一直普通攻擊」：退回普攻時完全靜默，
      玩家不知道為什麼；外加自動技能選單跟引擎的分類條件不一致
   3. 背包從下方導覽列進去時沒有返回鍵

   ★ 原則：全部用「包一層既有函式」的方式接進去，不改
   js/00-main.js 本體，也不動戰鬥公式、傷害、怪物強度、掉率。
*/
(function installV134Fixes(){
    "use strict";

    /* =====================================================
       1. 戰鬥空拍：輪到手動角色時要把指令列叫回來
       ===================================================== */

    /*
       ★ 根因（讀 js/00-main.js 確認）：
       updateActionHudVisibility()（31898）是依「當下的
       activeBattleCharacterIndex 是不是自動」來決定指令列要不要
       隱藏，但全專案只有三個地方呼叫它：
         - startTurn()（10042）——此時 index 恆為 0
         - startResolutionPhase()（11934）
         - toggleAutoBattle()（19112）
       宣告階段真正在「換人」的 beginCharacterTurn()（10078）
       從來沒有呼叫過它。

       所以只要 0 號是自動、1／2 號是手動，指令列在 startTurn 那次
       就被判定成「隱藏」，然後整個宣告階段都不會再更新——輪到手動
       角色時玩家看不到任何按鈕、什麼都不能做，只能眼睜睜等
       beginCharacterTurn() 裡那個 20 秒 setInterval（10241）跑完，
       直到 timeoutTurn() 印出「⏰ 時間到，本回合沒有行動。」
       一個手動角色就是 20 秒空拍，兩個就是 40 秒——這正是使用者
       說的「為何有空拍很久的時候」。

       這個狀態很容易進入：saveAutoSettingsFormToCharacter()（19884）
       只寫 skill/hp/sp/returnToCityWhenEmpty，從來不寫 enabled，
       所以 autoConfig.enabled 跟 autoConfig2/3.enabled 很容易不同步。

       修法：包一層 beginCharacterTurn()，等原函式把
       activeBattleCharacterIndex 推到正確的人之後，補呼叫一次
       updateActionHudVisibility()。原函式如果已經跑到底去呼叫
       startResolutionPhase()，這裡再叫一次也是安全的——那時
       battlePhase 已經是 "resolve"，同一個函式會正確地算出「該隱藏」。
    */
    if(typeof beginCharacterTurn==="function"){
        const originalBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(token){
            const result=originalBeginCharacterTurn.apply(this,arguments);
            if(typeof updateActionHudVisibility==="function"){
                updateActionHudVisibility();
            }
            return result;
        };
    }

    /* =====================================================
       2. 自動戰鬥：退回普攻時要說明原因
       ===================================================== */

    /*
       ★ 這一段原本在這裡（V134），已經在 V135 被更好的做法取代，
       所以整段移除，避免兩份邏輯同時印出重複的訊息。

       V134 的做法是「在原函式跑之前，自己複製一份引擎的四個判斷
       條件去預測會不會退回普攻」。缺點是：只要引擎因為某個沒被
       複製到的理由退回，預判就會全部通過、什麼都不印，玩家還是
       看到莫名其妙的普攻。使用者接著就回報了「我很確定有SP，
       自動戰鬥還是使用普通攻擊」——正是這種預判對不上的情況。

       V135 改成「以實際結果為準」：讓原函式跑完，再去看
       queuedPlayerActions 裡實際排進去的是什麼，只要
       「設定的是技能、實際卻是普通攻擊」就一定會印說明。
       詳見 js/30-v135-fixes.js 第 1 節。
    */


    /*
       ★ 調查記錄（給下一個接手的人，避免重複走冤枉路）：
       原本以為還要修「UI 選單跟引擎的分類條件不一致」——
       populateAutoSkillOptions()（00-main.js:31426）只濾掉
       buff/passive，但引擎（20245）連 heal/revive 也拒絕。

       實際查證後發現這是**死程式碼**：它操作的
       #autoSkillHome / #autoSkillBattle / #autoEnabled 這幾個元素
       在現在的 index.html 裡**根本不存在**（grep 結果都是 0），
       是舊版主城自動面板的殘留，這也正是 console 一直在印
       「找不到元素： autoSkillHome / autoEnabled …」的原因。

       玩家現在真正在用的是元素匣面板的 #autoSettingsActionSelect，
       由 switchAutoSettingsCharacter()（00-main.js:20052-20074）
       負責填充，而它**本來就有**正確濾掉 buff/passive/heal/revive。
       所以這裡不需要、也不應該再加一層修正。

       萬一 autoConfig.skill 因為舊存檔之類的原因還是留著一個
       heal/revive 技能，上面新增的回饋訊息會直接告訴玩家
       「屬於治療類技能，自動戰鬥目前不支援」，不會再靜默普攻，
       這樣就夠了。
    */


    /* =====================================================
       3. 背包返回鍵
       ===================================================== */

    /*
       ★ 根因（讀 index.html + css/00-main.css 確認）：
       #inventoryPage 唯一的關閉鍵 #mapInventoryOverlayClose
       （index.html:2158）被 CSS 綁死只在覆蓋層模式顯示：
         css/00-main.css:5604  .map-inventory-overlay-close{ display:none; }
         css/00-main.css:5607  #inventoryPage.map-inventory-overlay-open
                               .map-inventory-overlay-close{ display:flex !important; }
       而 .map-inventory-overlay-open 只有 openMapInventoryOverlay()
       （00-main.js:6980）會加。背包有三種進入方式，只有「從地圖頁」
       那一種會加這個 class；使用者截圖是從「下方導覽列」進去的
       （index.html:2329 的 showPage('inventory')），那條路徑
       #inventoryPage 從頭到尾沒有任何返回控制項。

       修法分兩半：
       - CSS（css/35-v134-fixes.css）：讓這顆按鈕在 #inventoryPage
         一律顯示，不再只綁覆蓋層 class
       - JS（這裡）：依使用者決定「返回上一個頁面」，包一層
         showPage() 記錄前一頁，再把按鈕的行為換成
         「覆蓋層開著 → 照舊關覆蓋層；否則 → 回上一頁」
    */
    let v134PreviousPage=null;
    let v134CurrentPage=null;

    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            /* 只在「真的會切過去」時才記錄——原函式在戰鬥中會直接
               return 擋掉切頁（00-main.js:7032），那種情況不能算數，
               否則返回鍵會指到一個從來沒去過的頁面。 */
            const willActuallySwitch=!(battleActive && page!=="battle");

            if(willActuallySwitch && page!==v134CurrentPage){
                if(v134CurrentPage!==null){
                    v134PreviousPage=v134CurrentPage;
                }
                v134CurrentPage=page;
            }

            return originalShowPage.apply(this,arguments);
        };
    }

    window.v134BackFromInventory=function(){
        /* 從地圖頁開的覆蓋層版本：維持原本的關閉行為，
           不要弄壞這條本來就正常的路徑。 */
        if(typeof mapInventoryOverlayOpen!=="undefined" && mapInventoryOverlayOpen){
            if(typeof closeMapInventoryOverlay==="function"){
                closeMapInventoryOverlay();
            }
            return;
        }

        /*
           借進角色彈窗的情況（switchCharacterTab("inventory") 會把
           整個 #inventoryPage 搬進 #homeFeatureModalBody）：這時候
           這顆按鈕應該關掉那個彈窗，而不是切頁。

           ★ 判斷條件刻意用「#inventoryPage 是不是真的被搬進彈窗裡」
           而不是「彈窗是不是可見」——後者太寬鬆：只要畫面上剛好有
           任何一個 home-feature 彈窗開著（即使背包是獨立整頁顯示、
           跟那個彈窗一點關係都沒有），就會誤判成借用情境，結果按了
           返回只是關掉那個不相干的彈窗、背包頁還留在原地。
           實測就踩到過這個情況。用 contains() 檢查父子關係才精準。
        */
        const modalBody=document.getElementById("homeFeatureModalBody");
        const inventoryPage=document.getElementById("inventoryPage");
        if(modalBody && inventoryPage && modalBody.contains(inventoryPage)){
            if(typeof closeHomeFeature==="function"){
                closeHomeFeature();
            }
            return;
        }

        const target=
            (v134PreviousPage && v134PreviousPage!=="inventory")
            ? v134PreviousPage
            : "home";

        showPage(target);
    };

    /* 把按鈕的 onclick 從寫死的 closeMapInventoryOverlay() 換成
       上面那個依情境判斷的版本。用 DOM 直接改，不動 index.html。 */
    function rebindInventoryBackButton(){
        const button=document.getElementById("mapInventoryOverlayClose");
        if(!button || button.dataset.v134Bound==="1"){ return; }
        button.dataset.v134Bound="1";
        button.setAttribute("onclick","v134BackFromInventory()");
        button.textContent="返回";
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",rebindInventoryBackButton,{once:true});
    }else{
        rebindInventoryBackButton();
    }

})();


/* bundled source: js/30-v135-fixes.js */
/*
   V135 — 這一輪的 4 項回報：
   1. 自動戰鬥「明明有SP還是普通攻擊」——改成「看實際結果」的回饋，
      不再只是複製一份引擎的判斷條件去猜
   2. 技能要顯示作用對象與數量（自動戰鬥設定、手動技能格、選目標提示）
   3. 護盾在滿血時看不到——血條與護盾改成共用同一個比例基準
   4. 所有出手／回合間隔統一調成 1.25 秒
*/
(function installV135Fixes(){
    "use strict";

    /* =====================================================
       1. 自動戰鬥回饋：改成「以實際結果為準」
       ===================================================== */

    /*
       ★ 為什麼要重做（V134 的做法不夠好）：
       V134 是在原函式跑之前，自己「複製一份」引擎的四個判斷條件
       （技能不存在／沒學會／SP不足／類型不支援）去預測會不會退回
       普攻。問題是——如果引擎因為某個我沒複製到的理由退回普攻，
       我的預判會全部通過、於是什麼都不印，玩家看到的還是「莫名其妙
       就是普攻、而且毫無說明」。使用者這次回報「我很確定有SP，
       自動戰鬥還是使用普通攻擊」正是這種情況：SP 明明夠，所以
       V134 的 SP 判斷不會觸發，但實際結果還是普攻。

       這一版改成完全不猜：先記下玩家設定的技能，讓原函式照常跑，
       跑完之後直接看 queuedPlayerActions 裡「實際被排進去的行動」
       是什麼。只要「設定的是技能、實際排進去的卻是普通攻擊」，
       就一定會印出說明——能對上原因就印具體原因，對不上就明講
       「原因不明」並把關鍵數值一起印出來。這樣不管引擎為什麼退回，
       玩家（跟之後除錯的人）都一定看得到線索，不會再有靜默失敗。
    */
    const v135LastReason={};

    function explainAutoFallback(characterIndex,configuredSkillId){
        const character=getPartyCharacterByIndex(characterIndex);
        const skill=skillDatabase[configuredSkillId];
        const name=(character && character.id)||("角色"+(characterIndex+1));

        if(!skill){
            return "找不到「"+configuredSkillId+"」這個技能資料，改用普通攻擊。";
        }

        const skillKey=getPartyCharacterKey(characterIndex);
        const level=getSkillLevel(skillKey,configuredSkillId);
        if(level<=0){
            return name+"還沒學會「"+skill.name+"」，改用普通攻擊。";
        }

        const spCost=skill.spCost!==undefined ? skill.spCost : (skill.cost||0);
        if(character && character.sp<spCost){
            return name+"SP不足（"+Math.floor(character.sp)+"/"+spCost+
                "），無法使用「"+skill.name+"」，改用普通攻擊。";
        }

        if(["buff","passive","heal","revive"].includes(skill.category)){
            const label=
                skill.category==="heal" ? "治療" :
                skill.category==="revive" ? "復活" :
                skill.category==="buff" ? "增益" : "被動";
            return "「"+skill.name+"」屬於"+label+"類技能，自動戰鬥目前不支援，改用普通攻擊。";
        }

        /* 四個已知原因都對不上——明講原因不明，並附上判斷用的數值，
           讓玩家可以直接回報這一行，不用再猜。 */
        return "「"+skill.name+"」被改成普通攻擊，原因不明"+
            "（等級"+level+"、SP "+(character ? Math.floor(character.sp) : "?")+"/"+spCost+
            "、類型"+skill.category+"）。請把這行回報給開發者。";
    }

    if(typeof autoActionForCharacter==="function"){
        const originalAutoActionForCharacter=autoActionForCharacter;
        autoActionForCharacter=function(characterIndex,token){
            const config=getPartyAutoConfig(characterIndex);
            const configuredSkillId=config ? config.skill : null;

            const result=originalAutoActionForCharacter.apply(this,arguments);

            try{
                /* V136 已接管設定持久化、fallback 說明與實際 queued action
                   校正；在這裡即時判斷旗標，避免兩層同時印重複訊息。
                   不管 V135/V136 兩支動態 script 誰先下載完成都安全。 */
                if(window.v136AutoBattleFixInstalled){
                    return result;
                }

                /* 只有「玩家真的設了一個技能」才需要檢查；normal/defend
                   本來就不是技能，沒有「被退回」這回事。 */
                if(
                    configuredSkillId &&
                    configuredSkillId!=="normal" &&
                    configuredSkillId!=="defend"
                ){
                    const queued=queuedPlayerActions[characterIndex];
                    const actualAction=queued ? queued.action : null;

                    if(actualAction==="normal"){
                        const reason=explainAutoFallback(characterIndex,configuredSkillId);
                        if(v135LastReason[characterIndex]!==reason){
                            v135LastReason[characterIndex]=reason;
                            addBattleLog("⚠️ "+reason);
                        }
                    }
                    else if(actualAction===configuredSkillId){
                        /* 這次成功放出技能了，清掉去重紀錄，
                           下次真的又退回時才會重新印一次。 */
                        v135LastReason[characterIndex]=null;
                    }
                }
            }catch(error){
                console.error("V135 自動戰鬥回饋判斷失敗：",error);
            }

            return result;
        };
    }


    /* =====================================================
       2. 技能作用對象／數量標示
       ===================================================== */

    /*
       ★ 依照使用者要求，把每個技能「打誰、打幾個」直接寫在畫面上，
       三個地方都要有：自動戰鬥設定的技能下拉、手動戰鬥的技能格、
       以及選好技能之後的選目標提示。

       對照 js/25-v131-fix-batch.js 的 getSkillTargets() 實際行為
       （那才是真正決定打到誰的地方）：
         single  → 只打中心那一個
         tri     → 取中心所在那一排的「左中右」最多3個
         row     → 中心所在那一整排
         all     → 場上全部存活怪物
         ally    → 我方單一目標
         allyAll → 我方全體（castBuffSkill 會取前3人）
         deadAlly→ 我方陣亡的單一目標
         none    → 不用選目標（對自己/全場生效）
    */
    const SKILL_TARGET_SCOPE_LABELS={
        single:"敵方一人",
        /* 不用括號寫「（同排左中右）」——這些標籤在自動戰鬥下拉裡
           本來就會被包進一層括號，再有內層括號會變成
           「冰旋一閃（敵方三人（同排左中右）））」很難讀，改用中點。 */
        tri:"敵方三人・同排左中右",
        row:"敵方整排",
        column:"敵方前後2人・同位置",
        all:"敵方全體",
        ally:"我方一人",
        allyAll:"我方全體",
        deadAlly:"我方陣亡一人",
        none:"自身"
    };

    function getSkillTargetScopeLabel(skill){
        if(!skill){ return ""; }
        return SKILL_TARGET_SCOPE_LABELS[skill.targetType]||"";
    }
    window.v135GetSkillTargetScopeLabel=getSkillTargetScopeLabel;

    /* --- 2a. 手動戰鬥的技能格：在技能名稱下面補一行作用對象 --- */
    if(typeof populateSkillQuickBar==="function"){
        const originalPopulateSkillQuickBar=populateSkillQuickBar;
        populateSkillQuickBar=function(){
            const result=originalPopulateSkillQuickBar.apply(this,arguments);

            try{
                const bar=document.getElementById("skillQuickBarGrid");
                if(!bar){ return result; }

                const characterId=getPartyCharacterKey(activeBattleCharacterIndex);
                const loadout=characterSkillLoadouts[characterId];
                if(!loadout){ return result; }

                Array.from(bar.children).forEach((button,i)=>{
                    const skillId=loadout.equippedSkills[i];
                    const skill=skillId ? skillDatabase[skillId] : null;
                    const label=getSkillTargetScopeLabel(skill);
                    if(!label){ return; }
                    if(button.querySelector(".v135-sq-scope")){ return; }

                    const costEl=button.querySelector(".sq-cost");
                    const scope=document.createElement("span");
                    scope.className="v135-sq-scope";
                    scope.textContent=label;
                    if(costEl && costEl.parentElement){
                        costEl.parentElement.insertBefore(scope,costEl);
                    }else{
                        button.appendChild(scope);
                    }
                });
            }catch(error){
                console.error("V135 技能格作用對象標示失敗：",error);
            }

            return result;
        };
    }

    /* --- 2b. 自動戰鬥設定的技能下拉：選項文字後面補作用對象 --- */
    function decorateAutoSettingsSkillOptions(){
        const select=document.getElementById("autoSettingsActionSelect");
        if(!select || !select.options){ return; }

        let changed=false;
        Array.from(select.options).forEach(option=>{
            const skill=skillDatabase[option.value];
            const label=getSkillTargetScopeLabel(skill);
            if(!label){ return; }
            if(option.textContent.indexOf("（"+label+"）")!==-1){ return; }
            option.textContent=option.textContent+"（"+label+"）";
            changed=true;
        });

        /*
           ★ 這裡一定要重新指派一次 .value：這幾個 <select> 在開場時
           被 initCustomDropdown()/makeSelectValueReactive() 換成了自訂的
           假下拉（見 js/00-main.js:4326 起），畫面上真正看得到的是那份
           另外渲染的清單，而它只有在 .value 被設定時才會重新渲染。
           只改 <option> 的文字不會反映到畫面上，必須靠這一行觸發重繪。
        */
        if(changed){
            select.value=select.value;
        }
    }

    if(typeof switchAutoSettingsCharacter==="function"){
        const originalSwitchAutoSettingsCharacter=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(){
            const result=originalSwitchAutoSettingsCharacter.apply(this,arguments);
            decorateAutoSettingsSkillOptions();
            return result;
        };
    }

    if(typeof openAutoBattleSettings==="function"){
        const originalOpenAutoBattleSettings=openAutoBattleSettings;
        openAutoBattleSettings=function(){
            const result=originalOpenAutoBattleSettings.apply(this,arguments);
            decorateAutoSettingsSkillOptions();
            return result;
        };
    }

    /*
       ★ 注意：saveAutoSettingsFormToCharacter() 存的是 <option> 的
       value（技能id），不是顯示文字，所以上面在文字後面加註記
       完全不會影響存檔內容，也不會讓 stillValid 判斷失效。
    */

    /* --- 2c. 選目標階段：提示列補上「這招打誰、打幾個」 --- */
    /*
       符咒也要有作用對象提示——它們不在 skillDatabase 裡（是 js/27
       自己的 talismanDefinitions），所以要另外查一次。冰封符打敵方
       單體、隱身符/結界符給我方單體，跟 js/27 的
       getTalismanTargetKind() 分流一致。
    */
    function getTalismanScopeLabel(actionType){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return ""; }
        const definition=window.v132GetTalismanDefinition(actionType);
        if(!definition){ return ""; }
        return definition.talismanEffect==="freeze" ? "敵方一人" : "我方一人";
    }

    function appendScopeToTargetPrompt(actionType){
        const promptAction=document.getElementById("battleTargetPromptAction");
        if(!promptAction){ return; }

        const label=
            getSkillTargetScopeLabel(skillDatabase[actionType]) ||
            getTalismanScopeLabel(actionType);
        if(!label){ return; }

        if(promptAction.textContent.indexOf(label)!==-1){ return; }
        promptAction.textContent=promptAction.textContent+"　→　"+label;
    }

    if(typeof setBattleTargetSelectionMode==="function"){
        const originalSetBattleTargetSelectionMode=setBattleTargetSelectionMode;
        setBattleTargetSelectionMode=function(actionType){
            const result=originalSetBattleTargetSelectionMode.apply(this,arguments);
            appendScopeToTargetPrompt(actionType);
            return result;
        };
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const originalSetBattleAllyTargetSelectionMode=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const result=originalSetBattleAllyTargetSelectionMode.apply(this,arguments);
            appendScopeToTargetPrompt(actionType);
            return result;
        };
    }


    /* =====================================================
       3. 護盾在滿血時看不見
       ===================================================== */

    /*
       ★ 根因：updateSingleCharacterBars()（js/00-main.js:22793）把
       血條寬度算成 hp/maxHP，護盾則是
         left  = hpPercent
         width = shieldRemaining/maxHP
       兩者共用同一個 maxHP 基準、而且護盾是「接在血條右邊」畫的。
       滿血時 hpPercent 正好是 100，護盾的起點就被推到血條最右緣之外，
       又因為 .hp-bar 是 overflow:hidden，整段白色護盾直接被裁掉——
       這就是使用者說的「滿血有護盾時完全看不出來」。

       依使用者指定的做法修：把血條和護盾放進同一個「總長度」裡按
       比例分配（總長 = maxHP + 護盾量），滿血時血條會往左縮一點，
       空出來的位置正好塞得下等值的護盾，兩段加起來剛好填滿整條。
       沒有護盾時分母就是 maxHP，行為跟原本完全一樣，不影響一般情況。
    */
    function getShieldRemaining(character){
        const buff=(character&&character.activeBuffs||[]).find(
            b=>b.type==="shield" && b.turnsLeft>0 && b.remaining>0
        );
        return buff ? Math.max(0,buff.remaining) : 0;
    }

    if(typeof updateSingleCharacterBars==="function"){
        const originalUpdateSingleCharacterBars=updateSingleCharacterBars;
        updateSingleCharacterBars=function(index,character,stats){
            const result=originalUpdateSingleCharacterBars.apply(this,arguments);

            try{
                const hpBar=document.getElementById("battlePlayerHPBar"+index);
                const shieldBar=document.getElementById("battlePlayerShieldBar"+index);
                if(!hpBar || !shieldBar || !character || !stats){ return result; }

                const maxHP=Math.max(1,Number(stats.maxHP)||1);
                const hp=Math.max(0,Math.min(maxHP,Number(character.hp)||0));
                const shield=getShieldRemaining(character);

                /* 沒有護盾就維持原本的算法，完全不動。 */
                if(shield<=0){
                    hpBar.style.width=(hp/maxHP*100)+"%";
                    shieldBar.style.left=(hp/maxHP*100)+"%";
                    shieldBar.style.width="0%";
                    return result;
                }

                const total=maxHP+shield;
                const hpPercent=hp/total*100;
                const shieldPercent=shield/total*100;

                hpBar.style.width=hpPercent+"%";
                shieldBar.style.left=hpPercent+"%";
                shieldBar.style.width=shieldPercent+"%";
            }catch(error){
                console.error("V135 護盾血條顯示失敗：",error);
            }

            return result;
        };
    }

})();


/* bundled source: js/31-v136-auto-battle-fix.js */
/*
   V136 — 自動戰鬥技能設定持久化與強制校正

   這一版處理兩個會讓玩家看到「明明有 SP 卻一直普通攻擊」的來源：
   1. 自動技能只在按下套用時才寫入；中途切換、廣告流程取消或舊版同步
      都可能讓實際設定仍停在 normal。
   2. 舊版同步函式會在判定選項無效時直接把設定洗成 normal，沒有留下
      玩家最後一次明確選過哪個技能，也沒有任何提示。

   V136 會在玩家選擇自動行動的當下立刻存檔，記住「普通攻擊／防禦／
   技能」的明確意圖；如果舊版同步誤把一個仍然有效的技能洗成普通攻擊，
   會自動恢復。戰鬥宣告時再以真正排入 queuedPlayerActions 的結果校正，
   所有退回普通攻擊的情況都會留下可讀原因。
*/
(function installV136AutoBattleFix(){
    "use strict";

    if(window.v136AutoBattleFixInstalled){ return; }
    window.v136AutoBattleFixInstalled=true;

    const lastNoticeByCharacter={};

    function normalizeAction(action){
        return typeof action==="string" && action
            ? action
            : "normal";
    }

    function getSkillCost(skill){
        if(!skill){ return 0; }
        const raw=skill.spCost!==undefined ? skill.spCost : (skill.cost||0);
        const numeric=Number(raw);
        return Number.isFinite(numeric) && numeric>0 ? numeric : 0;
    }

    function isUnsupportedAutoCategory(skill){
        return !!(
            skill &&
            ["buff","passive","heal","revive"].includes(skill.category)
        );
    }

    function isEquippedAndLearnedAutoSkill(characterIndex,skillId){
        const skill=skillDatabase[skillId];
        const skillKey=getPartyCharacterKey(characterIndex);
        const loadout=characterSkillLoadouts[skillKey];

        return !!(
            skill &&
            !isUnsupportedAutoCategory(skill) &&
            loadout &&
            Array.isArray(loadout.equippedSkills) &&
            loadout.equippedSkills.includes(skillId) &&
            getSkillLevel(skillKey,skillId)>0
        );
    }

    function rememberExplicitAction(characterIndex,action){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return; }

        const config=getPartyAutoConfig(characterIndex);
        const selected=normalizeAction(action);

        config.skill=selected;

        if(selected==="normal"){
            config.v136ActionIntent="normal";
        }
        else if(selected==="defend"){
            config.v136ActionIntent="defend";
        }
        else{
            config.v136ActionIntent="skill";
            config.v136LastSkill=selected;
        }
    }

    function migrateCurrentIntent(characterIndex){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return; }

        const config=getPartyAutoConfig(characterIndex);
        const selected=normalizeAction(config.skill);

        if(config.v136ActionIntent){ return; }

        if(selected==="normal"){
            config.v136ActionIntent="normal";
        }
        else if(selected==="defend"){
            config.v136ActionIntent="defend";
        }
        else{
            config.v136ActionIntent="skill";
            config.v136LastSkill=selected;
        }
    }

    function restoreSkillAfterLegacySync(characterIndex){
        const config=getPartyAutoConfig(characterIndex);

        if(
            config.v136ActionIntent==="skill" &&
            config.skill==="normal" &&
            isEquippedAndLearnedAutoSkill(characterIndex,config.v136LastSkill)
        ){
            config.skill=config.v136LastSkill;
            return true;
        }

        return false;
    }

    function saveCurrentActionFromPanel(){
        const characterSelect=document.getElementById("autoSettingsCharacterSelect");
        const actionSelect=document.getElementById("autoSettingsActionSelect");
        if(!characterSelect || !actionSelect){ return; }

        const characterIndex=Number(characterSelect.value);
        if(!getPartyCharacterByIndex(characterIndex)){ return; }

        rememberExplicitAction(characterIndex,actionSelect.value);

        if(typeof saveGame==="function"){
            saveGame();
        }
    }

    /* 舊存檔若本來就選了技能，先補上意圖欄位，之後不會再被同步洗掉。 */
    [0,1,2].forEach(migrateCurrentIntent);

    /*
       共用儲存入口也記錄意圖。即使之後 UI 又增加新的確認按鈕，只要仍
       經過 saveAutoSettingsFormToCharacter()，就不會漏掉這層保護。
    */
    if(typeof saveAutoSettingsFormToCharacter==="function"){
        const originalSaveAutoSettingsFormToCharacter=
            saveAutoSettingsFormToCharacter;

        saveAutoSettingsFormToCharacter=function(characterIndex){
            const result=originalSaveAutoSettingsFormToCharacter.apply(this,arguments);
            const config=getPartyAutoConfig(Number(characterIndex));
            rememberExplicitAction(Number(characterIndex),config.skill);
            return result;
        };
    }

    /*
       自訂下拉選單會手動 dispatch change；因此玩家點到技能的當下就立刻
       寫入設定與 localStorage，不必等最後一顆按鈕才第一次保存。
    */
    const actionSelect=document.getElementById("autoSettingsActionSelect");
    if(actionSelect && actionSelect.dataset.v136ImmediateSave!=="1"){
        actionSelect.dataset.v136ImmediateSave="1";
        actionSelect.addEventListener("change",saveCurrentActionFromPanel);
    }

    /*
       capture 階段先存一次，避免元素匣時數／廣告流程在外層 wrapper 提前
       return 時，畫面上已選好的技能完全沒有落盤。
    */
    document.addEventListener("click",event=>{
        const target=event.target;
        const button=target && target.closest
            ? target.closest("#autoBattleSettingsPanel .auto-save-btn")
            : null;
        if(button){
            saveCurrentActionFromPanel();
        }
    },true);

    /*
       保護兩個舊版選單同步函式：只有在玩家最後明確選的是技能、而且該
       技能現在仍已裝備且已學會時才恢復。玩家明確選「普通攻擊」或
       「防禦」時絕不會被擅自改掉。
    */
    if(typeof populateAutoSkillOptions==="function"){
        const originalPopulateAutoSkillOptions=populateAutoSkillOptions;
        populateAutoSkillOptions=function(){
            const result=originalPopulateAutoSkillOptions.apply(this,arguments);
            if(restoreSkillAfterLegacySync(0) && typeof saveGame==="function"){
                saveGame();
            }
            return result;
        };
    }

    if(typeof populateAutoSkillOptions2==="function"){
        const originalPopulateAutoSkillOptions2=populateAutoSkillOptions2;
        populateAutoSkillOptions2=function(){
            const result=originalPopulateAutoSkillOptions2.apply(this,arguments);
            if(restoreSkillAfterLegacySync(1) && typeof saveGame==="function"){
                saveGame();
            }
            return result;
        };
    }

    function getAutoDecision(characterIndex){
        const character=getPartyCharacterByIndex(characterIndex);
        const config=getPartyAutoConfig(characterIndex);
        const action=normalizeAction(config && config.skill);
        const name=(character && character.id)||("角色"+(characterIndex+1));

        if(action==="normal"){
            return {
                kind:"normal",
                action,
                message:name+"目前的自動行動設定是「普通攻擊」；SP充足不會自動改放技能，請在元素匣選擇要施放的技能。"
            };
        }

        if(action==="defend"){
            return {kind:"defend",action};
        }

        const skill=skillDatabase[action];
        if(!skill){
            return {
                kind:"fallback",
                action,
                message:"找不到「"+action+"」的技能資料，已改用普通攻擊。"
            };
        }

        const skillKey=getPartyCharacterKey(characterIndex);
        const loadout=characterSkillLoadouts[skillKey];
        if(
            !loadout ||
            !Array.isArray(loadout.equippedSkills) ||
            !loadout.equippedSkills.includes(action)
        ){
            return {
                kind:"fallback",
                action,
                message:name+"沒有裝備「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        const level=getSkillLevel(skillKey,action);
        if(level<=0){
            return {
                kind:"fallback",
                action,
                message:name+"尚未學會「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        if(isUnsupportedAutoCategory(skill)){
            return {
                kind:"fallback",
                action,
                message:"「"+skill.name+"」不是自動戰鬥可施放的攻擊技能，已改用普通攻擊。"
            };
        }

        const spCost=getSkillCost(skill);
        const currentSP=character ? Number(character.sp)||0 : 0;
        if(currentSP<spCost){
            return {
                kind:"fallback",
                action,
                message:name+"的SP不足（"+Math.floor(currentSP)+"/"+spCost+
                    "），無法施放「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        return {kind:"skill",action,skill,spCost};
    }

    function addNoticeOnce(characterIndex,key,message){
        if(lastNoticeByCharacter[characterIndex]===key){ return; }
        lastNoticeByCharacter[characterIndex]=key;
        addBattleLog("⚠️ "+message);
    }

    function getPriorityAutoTarget(){
        const indexes=typeof currentBattleMonsters!=="undefined"&&Array.isArray(currentBattleMonsters)
            ?currentBattleMonsters:[];
        const priority=typeof window.v148GetAutoTargetPriority==="function"
            ?window.v148GetAutoTargetPriority(indexes):indexes.slice();
        return priority.find(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            return !!(monster&&monster.alive!==false&&(Number(monster.hp)||0)>0);
        });
    }

    function queuedActionTargetsEnemy(queued){
        if(!queued){ return false; }
        if(queued.action==="normal"){ return true; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
        return !!(skill&&(skill.category==="physical"||skill.category==="magic")&&skill.targetType!=="none");
    }

    function enforceAutoTargetPriority(queued){
        if(!queuedActionTargetsEnemy(queued)){ return; }
        const target=getPriorityAutoTarget();
        if(Number.isInteger(target)){ queued.target=target; }
    }

    /*
       最後一道保護：原引擎跑完後直接檢查實際 queued action。如果所有
       合法條件都通過、卻仍被排成 normal，就把該筆佇列校正回玩家選的
       技能。這一層只處理「已裝備、已學會、類型正確、SP足夠」的技能，
       不會繞過任何合法限制。
    */
    if(typeof autoActionForCharacter==="function"){
        const originalAutoActionForCharacter=autoActionForCharacter;

        autoActionForCharacter=function(characterIndex,token){
            if(
                restoreSkillAfterLegacySync(characterIndex) &&
                typeof saveGame==="function"
            ){
                saveGame();
            }
            const decision=getAutoDecision(characterIndex);
            const result=originalAutoActionForCharacter.apply(this,arguments);

            try{
                const character=getPartyCharacterByIndex(characterIndex);
                const config=getPartyAutoConfig(characterIndex);
                const autoOn=characterIndex===0 ? autoBattle : config.enabled;

                if(
                    !battleActive ||
                    !character ||
                    character.hp<=0 ||
                    !autoOn ||
                    token!==battleToken
                ){
                    return result;
                }

                const queued=queuedPlayerActions[characterIndex];

                if(decision.kind==="skill"){
                    if(queued && queued.action==="normal"){
                        queued.action=decision.action;
                        addNoticeOnce(
                            characterIndex,
                            "corrected:"+decision.action,
                            "偵測到「"+decision.skill.name+"」被錯誤排成普通攻擊，已自動校正並施放技能。"
                        );
                    }
                    else if(queued && queued.action===decision.action){
                        lastNoticeByCharacter[characterIndex]=null;
                    }
                }
                else if(decision.kind==="fallback" && queued){
                    /* 舊引擎沒有檢查「技能仍在裝備欄」；設定殘留時甚至可能
                       反過來施放未裝備技能。V136 在同一個決策點一起收口。 */
                    queued.action="normal";
                    addNoticeOnce(
                        characterIndex,
                        "fallback:"+decision.action+":"+decision.message,
                        decision.message
                    );
                }
                else if(decision.kind==="normal" && queued && queued.action==="normal"){
                    addNoticeOnce(
                        characterIndex,
                        "explicit-normal",
                        decision.message
                    );
                }

                /* Offensive auto actions share one stable position priority.
                   They keep attacking target #1 while it lives, then advance
                   #2 → #3 → #4 → #5 only after the earlier position dies. */
                enforceAutoTargetPriority(queued);
            }
            catch(error){
                console.error("V136 自動戰鬥校正失敗：",error);
            }

            return result;
        };
    }

    /* 提供給瀏覽器測試／之後除錯，直接讀到引擎同一份判斷結果。 */
    window.v136GetAutoBattleDecision=getAutoDecision;
    window.v136GetPriorityAutoTarget=getPriorityAutoTarget;
})();


/* bundled source: js/32-v139-rested-experience.js */
/*
   V139 — 休息經驗

   - 離線／切到背景每2分鐘累積1場，最多300場。
   - 一般練功勝利消耗1場，該場EXP變成2倍。
   - 元素匣啟用期間不累積；元素匣與副本也不使用、不消耗。
   - 狀態存於獨立localStorage key，不改既有主存檔結構。
*/
(function installV139RestedExperience(){
    "use strict";

    const RESTED_EXP_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("rested-exp-state");
    const RESTED_EXP_MAX_BATTLES=300;
    const RESTED_EXP_MINUTES_PER_BATTLE=2;
    const RESTED_EXP_MS_PER_BATTLE=RESTED_EXP_MINUTES_PER_BATTLE*60*1000;
    const RESTED_EXP_HEARTBEAT_MS=30*1000;

    function emptyRestedState(now){
        return {
            battles:0,
            progressMs:0,
            lastSeenAt:now,
            blockedByElementBox:false
        };
    }

    function hasCreatedCharacter(){
        return typeof player!=="undefined" && !!(player && player.id);
    }

    function sanitizeRestedState(raw,now){
        const source=raw && typeof raw==="object" ? raw : {};
        return {
            battles:Math.min(
                RESTED_EXP_MAX_BATTLES,
                Math.max(0,Math.floor(Number(source.battles)||0))
            ),
            progressMs:Math.max(
                0,
                Math.min(
                    RESTED_EXP_MS_PER_BATTLE-1,
                    Math.floor(Number(source.progressMs)||0)
                )
            ),
            lastSeenAt:Number.isFinite(Number(source.lastSeenAt))
                ? Math.min(now,Number(source.lastSeenAt))
                : now,
            blockedByElementBox:source.blockedByElementBox===true
        };
    }

    function readRestedState(now){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return emptyRestedState(now);
        }
        try{
            const raw=JSON.parse(localStorage.getItem(RESTED_EXP_STORAGE_KEY)||"null");
            return sanitizeRestedState(raw,now);
        }catch(_){
            return emptyRestedState(now);
        }
    }

    let restedState=readRestedState(Date.now());

    function persistRestedState(){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return;
        }
        try{
            localStorage.setItem(
                RESTED_EXP_STORAGE_KEY,
                JSON.stringify({
                    battles:restedState.battles,
                    progressMs:restedState.progressMs,
                    lastSeenAt:restedState.lastSeenAt,
                    blockedByElementBox:restedState.blockedByElementBox
                })
            );
        }catch(_){ }
    }

    function accrueRestedMilliseconds(elapsedMs){
        const safeElapsed=Math.max(0,Math.floor(Number(elapsedMs)||0));
        if(safeElapsed<=0 || restedState.battles>=RESTED_EXP_MAX_BATTLES){
            if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
                restedState.progressMs=0;
            }
            return 0;
        }

        /* 超過累積上限所需的時間沒有差別，先封頂避免異常時鐘
           產生不必要的大數字。 */
        const cappedElapsed=Math.min(
            safeElapsed,
            RESTED_EXP_MAX_BATTLES*RESTED_EXP_MS_PER_BATTLE
        );
        const totalMs=restedState.progressMs+cappedElapsed;
        const earned=Math.floor(totalMs/RESTED_EXP_MS_PER_BATTLE);
        const accepted=Math.min(
            earned,
            RESTED_EXP_MAX_BATTLES-restedState.battles
        );

        restedState.battles+=accepted;
        restedState.progressMs=restedState.battles>=RESTED_EXP_MAX_BATTLES
            ? 0
            : totalMs-earned*RESTED_EXP_MS_PER_BATTLE;
        return accepted;
    }

    function getNextRestedBattleText(){
        if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
            return "已達累積上限";
        }
        const remainingMs=Math.max(
            1,
            RESTED_EXP_MS_PER_BATTLE-restedState.progressMs
        );
        return "距離下一場約 "+Math.ceil(remainingMs/60000)+" 分鐘";
    }

    function updateRestedExperienceDisplay(){
        const count=document.getElementById("v139RestedExpCount");
        const next=document.getElementById("v139RestedExpNext");
        if(count){ count.textContent=String(restedState.battles); }
        if(next){ next.textContent=getNextRestedBattleText(); }
    }

    function renderRestedExperiencePanel(){
        return (
            '<section class="v139-rested-exp-panel" aria-label="休息經驗">'+
                '<div class="v139-rested-exp-heading">休息經驗</div>'+
                '<div class="v139-rested-exp-count">'+
                    '<strong id="v139RestedExpCount">'+restedState.battles+'</strong>'+
                    '<span>／'+RESTED_EXP_MAX_BATTLES+' 場</span>'+
                '</div>'+
                '<p>一般練功勝利 EXP ×2；元素匣啟用期間不累積，元素匣與副本也不會使用或消耗。</p>'+
                '<div class="v139-rested-exp-meta">'+
                    '每離線 '+RESTED_EXP_MINUTES_PER_BATTLE+' 分鐘累積 1 場・'+
                    '<span id="v139RestedExpNext">'+getNextRestedBattleText()+'</span>'+
                '</div>'+
            '</section>'
        );
    }

    if(typeof renderOfflineExpContent==="function"){
        const originalRenderOfflineExpContent=renderOfflineExpContent;
        renderOfflineExpContent=function(){
            return originalRenderOfflineExpContent.apply(this,arguments)+
                renderRestedExperiencePanel();
        };
    }

    function isElementBoxActive(){
        if(typeof window.v131GetElementBoxState!=="function"){ return false; }
        try{
            const state=window.v131GetElementBoxState();
            return !!(state && state.active);
        }catch(_){
            return false;
        }
    }

    function syncAccrualToNow(){
        const now=Date.now();
        if(!restedState.blockedByElementBox && !isElementBoxActive()){
            accrueRestedMilliseconds(now-restedState.lastSeenAt);
        }
        restedState.lastSeenAt=now;
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
        updateRestedExperienceDisplay();
    }

    /* 第一次載入時，把上次心跳到現在的時間視為離線時間。
       新系統第一次出現時沒有舊狀態，不會倒推發送不存在的場數。 */
    if(hasCreatedCharacter()){
        syncAccrualToNow();
    }

    window.v139RestedExpConfig=Object.freeze({
        maxBattles:RESTED_EXP_MAX_BATTLES,
        minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
        multiplier:2
    });

    window.v139GetRestedExpState=function(){
        return {
            battles:restedState.battles,
            progressMs:restedState.progressMs,
            maxBattles:RESTED_EXP_MAX_BATTLES,
            minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
            blockedByElementBox:restedState.blockedByElementBox
        };
    };

    window.v139AccrueRestedMinutes=function(minutes){
        const earned=accrueRestedMilliseconds(
            Math.max(0,Number(minutes)||0)*60*1000
        );
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return earned;
    };

    window.v139TryConsumeRestedBattle=function(){
        if(restedState.battles<=0){
            return {applied:false,remainingBattles:0};
        }
        restedState.battles--;
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return {
            applied:true,
            remainingBattles:restedState.battles
        };
    };

    document.addEventListener("visibilitychange",function(){
        if(document.hidden){
            restedState.lastSeenAt=Date.now();
            restedState.blockedByElementBox=isElementBoxActive();
            persistRestedState();
            return;
        }
        syncAccrualToNow();
    });

    function markVisibleHeartbeat(){
        if(document.hidden){ return; }
        restedState.lastSeenAt=Date.now();
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
    }

    window.addEventListener("pagehide",function(){
        if(!document.hidden){ markVisibleHeartbeat(); }
    });
    window.addEventListener("beforeunload",markVisibleHeartbeat);
    setInterval(markVisibleHeartbeat,RESTED_EXP_HEARTBEAT_MS);

})();


/* bundled source: js/33-v140-four-element-balance.js */
/* =====================================================
   V140 — 四元素技能平衡定案

   以 2026-08-27 玩家提供的完整四元素技能表為準：
   1. 校正四元素技能數值與說明
   2. 物理／法術技能的異常命中屬性來源
   3. 水系七招吸血只回復 HP
   4. 怒火的爆擊率與爆擊傷害分開計算
   5. 治療術只會為其他友方目標回復 SP，不補施放者本人 SP
   6. 技能「結界」只擋 5 次直接傷害、最多 5 回合，DOT 穿透
   7. 最終命中率下限 60% → 50%

   不重構其他戰鬥系統，不改玩家能力、存檔結構，
   符咒與對應技能共用同一套效果規則。
===================================================== */
(function applyV140FourElementBalance(){
    "use strict";

    const GENERAL_STATUS_BOUNDS={min:5,max:95};
    const LOCKDOWN_STATUS_BOUNDS={
        regular:{min:5,max:80},
        elite:{min:5,max:60},
        boss:{min:5,max:40}
    };
    const LEVEL_FACTOR_PER_LEVEL=0.02;
    const LEVEL_FACTOR_MIN=0.70;
    const LEVEL_FACTOR_MAX=1.30;
    const GENERAL_STATUS_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_COEFFICIENT=0.2;
    const GENERAL_STATUS_SPIRIT_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_SPIRIT_COEFFICIENT=0.3;

    const LIFESTEAL_BY_SKILL={
        waterKnife:[4,5,6,7,8],
        frostPunch:[4,5,6,7,8],
        iceSpin:[3,4,5,6,7],
        frostCrush:[4,5,6,7,8],
        waterBall:[3,4,5,6,7],
        floodBeast:[4,5,6,7,8],
        iceArrowRain:[1,2,3,4,5]
    };

    let statusSkillContext=null;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    function setDamageSkill(skillId,baseDamage,damagePerLevel,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.baseDamage=baseDamage;
        skill.damagePerLevel=damagePerLevel;
        skill.description=description;
    }

    function setLifestealSkill(skillId,values,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.lifestealPercentByLevel=values.slice();
        skill.description=description;
    }

    function setSkillFields(skillId,fields){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        Object.keys(fields).forEach(key=>{
            const value=fields[key];
            skill[key]=Array.isArray(value)?value.slice():value;
        });
    }

    setDamageSkill(
        "fireRocket",
        17,
        8,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害，最高5級，每升1級傷害+8。"
    );

    setSkillFields("flameTornado",{
        burnPercentByLevel:[3,4,5,6,8],
        description:"對任一橫排目標各造成40點基礎法術傷害；30%基礎機率燃燒2回合，每回合造成目標最大HP的3%/4%/5%/6%/8%傷害。"
    });

    setSkillFields("phoenixCry",{
        burnPercentByLevel:[5,7,9,11,13],
        description:"對敵方全體各造成53點基礎法術傷害；50%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%傷害。"
    });

    setSkillFields("rage",{
        /* 舊引擎仍讀 critBonusByLevel，讓它代表爆擊率以保留相容。 */
        critBonusByLevel:[5,10,15,20,25],
        critChanceBonusByLevel:[5,10,15,20,25],
        critDamageBonusByLevel:[10,20,30,40,50],
        description:"提高我方最多3名存活角色的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合。"
    });

    setSkillFields("stormFist",{
        agilityDownByLevel:[30,40,50,60,70],
        description:"對單體造成14點基礎傷害；50%基礎機率降低敏捷1回合，降低30%/40%/50%/60%/70%。"
    });

    setSkillFields("healSpell",{
        description:"擇一友方目標，恢復HP與SP。HP基礎40、SP基礎15，兩者每升1級基礎恢復量+5；保留既有智力與水元素EX回復加成，施放者本人不回復SP。"
    });

    setSkillFields("barrier",{
        spCost:40,
        duration:5,
        barrierBlockCount:5,
        description:"使我方單一目標獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不會被抵擋，也不消耗次數。"
    });

    setDamageSkill(
        "frostPunch",
        30,
        8,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );

    setDamageSkill(
        "stoneBreakSky",
        65,
        9,
        "對單體造成65點基礎傷害；為我方全體增加100/125/150/175/200點護盾，持續2回合。"
    );

    setLifestealSkill(
        "waterKnife",
        LIFESTEAL_BY_SKILL.waterKnife,
        "對單體造成13點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostPunch",
        LIFESTEAL_BY_SKILL.frostPunch,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceSpin",
        LIFESTEAL_BY_SKILL.iceSpin,
        "對同一橫排左、中、右最多3名目標各造成25點基礎傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostCrush",
        LIFESTEAL_BY_SKILL.frostCrush,
        "對單體造成100點基礎傷害；45%機率冰封1回合；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "waterBall",
        LIFESTEAL_BY_SKILL.waterBall,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "floodBeast",
        LIFESTEAL_BY_SKILL.floodBeast,
        "對單體造成35點基礎法術傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceArrowRain",
        LIFESTEAL_BY_SKILL.iceArrowRain,
        "對敵方全體各造成30點基礎法術傷害；吸取實際造成傷害的1%/2%/3%/4%/5%，只恢復自身HP；並有50%基礎機率使隨機單一目標冰封2回合。"
    );

    /*
       純計算入口同時供正式判定與回歸測試使用。
       等級差、精神、額外抗性及既有上下限完整保留；
       一般異常的物理攻擊／智力與目標精神統一使用0.05；
       硬控仍維持開根號屬性加成與原本精神係數。
    */
    function calculateV140StatusChance(
        baseChancePercent,
        casterLevel,
        targetLevel,
        offensivePower,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent,
        skillCategory
    ){
        const levelFactor=clamp(
            1+(numeric(casterLevel)-numeric(targetLevel))*LEVEL_FACTOR_PER_LEVEL,
            LEVEL_FACTOR_MIN,
            LEVEL_FACTOR_MAX
        );

        const power=Math.max(0,numeric(offensivePower));
        const attributeBonus=isLockdown
            ? Math.sqrt(power)*LOCKDOWN_STATUS_COEFFICIENT
            : power*GENERAL_STATUS_COEFFICIENT;
        const spiritCoefficient=isLockdown
            ? LOCKDOWN_STATUS_SPIRIT_COEFFICIENT
            : GENERAL_STATUS_SPIRIT_COEFFICIENT;

        const rawChance=
            numeric(baseChancePercent)*levelFactor+
            attributeBonus-
            Math.max(0,numeric(targetSpirit))*spiritCoefficient-
            numeric(targetBonusResistancePercent);

        const bounds=isLockdown
            ? (LOCKDOWN_STATUS_BOUNDS[targetRank]||LOCKDOWN_STATUS_BOUNDS.regular)
            : GENERAL_STATUS_BOUNDS;

        return clamp(rawChance,bounds.min,bounds.max);
    }

    window.v140CalculateStatusEffectChance=calculateV140StatusChance;

    const previousCalculateStatusEffectChance=calculateStatusEffectChance;
    calculateStatusEffectChance=function(
        baseChancePercent,
        casterLevel,
        targetLevel,
        casterIntelligence,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent
    ){
        const context=statusSkillContext;
        const category=context&&context.skill
            ? context.skill.category
            : "magic";
        const offensivePower=context&&context.skill
            ? (category==="physical"
                ? context.physicalAttack
                : context.intelligence)
            : casterIntelligence;

        return calculateV140StatusChance(
            baseChancePercent,
            casterLevel,
            targetLevel,
            offensivePower,
            targetSpirit,
            isLockdown,
            targetRank,
            targetBonusResistancePercent,
            category
        );
    };

    /*
       命中先依既有命中值算出基礎命中率，再讓正式閃躲率獨立擲算。
       閃躲來源本身已在角色能力端用乘算合併，最終上限85%。
    */
    function getV140HitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        const rawAccuracyChance=
            95+
            casterAccuracy*0.3-
            (directChanceReductionPercent||0);

        const accuracyChance=clamp(
            rawAccuracyChance,
            50,
            99
        );
        const evasionRate=clamp(targetEvasion,0,85);

        return clamp(accuracyChance*(1-evasionRate/100),1,99);
    }

    window.v140GetHitChancePercent=getV140HitChancePercent;

    rollHitChance=function(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        return Math.random()*100<getV140HitChancePercent(
            casterAccuracy,
            targetEvasion,
            directChanceReductionPercent
        );
    };

    /*
       怒火改為兩組獨立數值。舊函式一次只讀 bonusPercent，
       因此先以爆擊率加成讓舊函式完成擲骰，命中爆擊後
       再只補上爆傷差額；其他自然爆擊、火EX與抗暴公式不變。
    */
    const previousRollCritical=rollCritical;
    rollCritical=function(character,category,targetAntiCritPercent){
        const rageBuff=(character&&character.activeBuffs||[])
            .find(buff=>buff&&buff.type==="rage");

        if(
            !rageBuff||
            rageBuff.critChanceBonusPercent===undefined||
            rageBuff.critDamageBonusPercent===undefined
        ){
            return previousRollCritical.apply(this,arguments);
        }

        const previousBonus=rageBuff.bonusPercent;
        const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
        const damageBonus=numeric(rageBuff.critDamageBonusPercent);
        let result;

        rageBuff.bonusPercent=chanceBonus;
        try{
            result=previousRollCritical.apply(this,arguments);
        }finally{
            rageBuff.bonusPercent=previousBonus;
        }

        if(result&&result.isCrit){
            return Object.assign({},result,{
                multiplier:Math.min(
                    typeof CRIT_MULTIPLIER_MAX==="number"?CRIT_MULTIPLIER_MAX:2.25,
                    result.multiplier+(damageBonus-chanceBonus)/100
                )
            });
        }
        return result;
    };

    /* 背包角色詳情也要顯示同一組實際戰鬥數值。 */
    if(typeof getInventoryCharacterCriticalStats==="function"){
        const previousGetInventoryCharacterCriticalStats=
            getInventoryCharacterCriticalStats;

        getInventoryCharacterCriticalStats=function(index){
            const character=typeof getBackpackCharacter==="function"
                ? getBackpackCharacter(index)
                : null;
            const buffs=character&&Array.isArray(character.activeBuffs)
                ? character.activeBuffs
                : null;
            const rageBuff=buffs&&buffs.find(buff=>
                buff&&
                buff.type==="rage"&&
                buff.critChanceBonusPercent!==undefined&&
                buff.critDamageBonusPercent!==undefined
            );

            if(!rageBuff){
                return previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }

            character.activeBuffs=buffs.filter(buff=>buff!==rageBuff);
            let result;
            try{
                result=previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }finally{
                character.activeBuffs=buffs;
            }

            if(!result){ return result; }
            const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
            const damageBonus=numeric(rageBuff.critDamageBonusPercent)/100;
            ["physical","magic"].forEach(key=>{
                if(!result[key]){ return; }
                result[key].chance+=chanceBonus;
                result[key].multiplier+=damageBonus;
            });
            return result;
        };
    }

    function getV140RageValues(level){
        const skill=skillDatabase.rage||{};
        const index=Math.max(0,numeric(level)-1);
        return {
            chance:numeric((skill.critChanceBonusByLevel||[])[index]),
            damage:numeric((skill.critDamageBonusByLevel||[])[index])
        };
    }

    function isV140SkillBarrier(buff){
        return !!(
            buff&&
            buff.type==="barrier"&&
            buff.turnsLeft>0
        );
    }

    let directBarrierCastContext=null;

    function consumeV140DirectBarrier(character){
        if(
            directBarrierCastContext&&
            directBarrierCastContext.blockedCharacters.has(character)
        ){
            return true;
        }

        const buffs=character&&Array.isArray(character.activeBuffs)
            ? character.activeBuffs
            : [];
        const barrier=buffs.find(isV140SkillBarrier);
        if(!barrier){ return false; }

        if(!Number.isFinite(Number(barrier.remainingBlocks))){
            barrier.remainingBlocks=numeric(skillDatabase.barrier.barrierBlockCount)||5;
        }

        const remaining=Math.max(0,numeric(barrier.remainingBlocks));
        if(remaining<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
            return false;
        }

        barrier.remainingBlocks=remaining-1;
        if(directBarrierCastContext){
            directBarrierCastContext.blockedCharacters.add(character);
        }
        if(barrier.remainingBlocks<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
        }
        return true;
    }

    window.v140ConsumeDirectBarrier=consumeV140DirectBarrier;
    window.v173WithDirectBarrierCast=function(callback){
        const previousContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        try{ return callback(); }
        finally{ directBarrierCastContext=previousContext; }
    };

    /* 讓技能施放後的 buff 帶有新規格需要的獨立欄位。 */
    const previousCastBuffSkill=castBuffSkill;
    castBuffSkill=function(skillId,targetIndex){
        const skill=skillDatabase[skillId];
        const level=skill&&typeof getSkillLevel==="function"
            ? getSkillLevel("fire",skillId)
            : 0;
        const rageValues=getV140RageValues(level);
        let didCast=false;

        const previousBadge=typeof showSkillNameBadge==="function"
            ? showSkillNameBadge
            : null;
        const previousLog=typeof addBattleLog==="function"
            ? addBattleLog
            : null;

        if(previousBadge){
            showSkillNameBadge=function(skillName){
                if(skill&&skillName===skill.name){ didCast=true; }
                return previousBadge.apply(this,arguments);
            };
        }

        if(previousLog&&(skillId==="rage"||skillId==="barrier")){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                if(skillId==="rage"&&String(message).includes("怒火生效")){
                    args[0]=
                        "怒火生效！我方最多3人爆擊率提升"+
                        rageValues.chance+"%、爆擊傷害提升"+
                        rageValues.damage+"%，持續"+skill.duration+"回合。";
                }
                else if(skillId==="barrier"&&String(message).includes("獲得結界")){
                    args[0]=String(message).replace(
                        /可抵擋所有傷害，持續\d+回合。/,
                        "可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                }
                return previousLog.apply(this,args);
            };
        }

        let result;
        try{
            result=previousCastBuffSkill.apply(this,arguments);
        }finally{
            if(previousBadge){ showSkillNameBadge=previousBadge; }
            if(previousLog&&(skillId==="rage"||skillId==="barrier")){
                addBattleLog=previousLog;
            }
        }

        if(!didCast){ return result; }

        if(skillId==="rage"&&typeof getActivePlayerCharacters==="function"){
            getActivePlayerCharacters().slice(0,3).forEach(character=>{
                const buff=(character.activeBuffs||[])
                    .find(entry=>entry.type==="rage"&&entry.turnsLeft>0);
                if(!buff){ return; }
                buff.bonusPercent=rageValues.chance;
                buff.critChanceBonusPercent=rageValues.chance;
                buff.critDamageBonusPercent=rageValues.damage;
            });
        }
        else if(skillId==="barrier"){
            const target=typeof getBattleCharacterByIndex==="function"
                ? getBattleCharacterByIndex(
                    targetIndex===null||targetIndex===undefined?0:targetIndex
                )
                : null;
            const buff=target&&(target.activeBuffs||[])
                .find(entry=>entry.type==="barrier"&&entry.turnsLeft>0);
            if(buff){
                buff.sourceSkill="barrier";
                buff.barrierRule="shared";
                buff.remainingBlocks=numeric(skill.barrierBlockCount)||5;
            }
        }

        return result;
    };

    /*
       符咒不另寫一份持續回合與結界規則：冰封符、隱身符、
       結界符分別讀對應技能。階級機率只負責畫符啟動；畫符成功後再依角色素質套用對應技能命中規則。
    */
    function syncV140TalismanDefinitions(){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return; }

        const effects={
            freeze:{
                skillId:"freeze",
                duration:numeric(skillDatabase.freeze&&skillDatabase.freeze.freezeDuration)
            },
            stealth:{
                skillId:"stealthSkill",
                duration:numeric(skillDatabase.stealthSkill&&skillDatabase.stealthSkill.duration)
            },
            barrier:{
                skillId:"barrier",
                duration:numeric(skillDatabase.barrier&&skillDatabase.barrier.duration),
                blockCount:numeric(skillDatabase.barrier&&skillDatabase.barrier.barrierBlockCount)
            }
        };
        const tiers=["Low","Mid","High","Perfect"];

        Object.entries(effects).forEach(([effectKey,effect])=>{
            tiers.forEach(tier=>{
                const definition=window.v132GetTalismanDefinition(
                    effectKey+"Talisman"+tier
                );
                if(!definition){ return; }
                definition.sharedSkillId=effect.skillId;
                definition.talismanSkillLevel=Math.max(1,numeric(skillDatabase[effect.skillId]&&skillDatabase[effect.skillId].maxLevel)||1);
                if(effect.duration>0){ definition.talismanDuration=effect.duration; }
                if(effect.blockCount>0){ definition.barrierBlockCount=effect.blockCount; }
            });
        });
    }

    syncV140TalismanDefinitions();

    if(
        typeof resolveQueuedPlayerAction==="function"&&
        typeof window.v132GetTalismanDefinition==="function"
    ){
        const previousResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=typeof queuedPlayerActions!=="undefined"
                ? queuedPlayerActions[characterIndex]
                : null;
            const definition=queued&&queued.action
                ? window.v132GetTalismanDefinition(queued.action)
                : null;

            if(!definition){
                return previousResolveQueuedPlayerAction.apply(this,arguments);
            }

            let target=null;
            let previousBuffs=[];
            if(definition.talismanEffect==="barrier"){
                const caster=getBattleCharacterByIndex(characterIndex);
                target=queued&&Number.isInteger(queued.targetAlly)
                    ? getBattleCharacterByIndex(queued.targetAlly)
                    : caster;
                if(!target||target.hp<=0){ target=caster; }
                previousBuffs=target&&Array.isArray(target.activeBuffs)
                    ? target.activeBuffs.slice()
                    : [];
            }

            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog&&definition.talismanEffect==="barrier"){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    args[0]=String(message).replace(
                        /獲得結界，可抵擋所有傷害，持續\d+回合。/,
                        "獲得結界，可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                    return previousLog.apply(this,args);
                };
            }

            let result;
            try{
                result=previousResolveQueuedPlayerAction.apply(this,arguments);
            }finally{
                if(previousLog&&definition.talismanEffect==="barrier"){
                    addBattleLog=previousLog;
                }
            }

            if(target&&definition.talismanEffect==="barrier"){
                const buff=(target.activeBuffs||[]).find(entry=>
                    entry&&
                    entry.type==="barrier"&&
                    !previousBuffs.includes(entry)
                );
                if(buff){
                    buff.turnsLeft=numeric(skillDatabase.barrier.duration)||5;
                    buff.remainingBlocks=
                        numeric(skillDatabase.barrier.barrierBlockCount)||5;
                    buff.sourceTalisman=definition.id;
                    buff.barrierRule="shared";
                }
            }

            return result;
        };
    }

    function hpOnlyLifestealText(value){
        return String(value)
            .replace(/攻擊技能可吸取HP與SP/g,"攻擊技能可吸取HP")
            .replace(/HP\/SP吸取/g,"HP吸取")
            .replace(/等量回復自身HP與SP/g,"只回復自身HP")
            .replace(/等量恢復自身HP與SP/g,"只恢復自身HP")
            .replace(/（回復HP\/SP）/g,"（只回復HP）");
    }

    function hpOnlyBattleLogText(value){
        return hpOnlyLifestealText(value)
            .replace(/點HP與SP/g,"點HP")
            .replace(/回復HP與SP/g,"回復HP")
            .replace(/恢復(\d+)點HP、\d+點SP/g,"恢復$1點HP");
    }

    function correctV140SkillText(value,skill,level){
        let text=hpOnlyLifestealText(value);

        const rage=skillDatabase.rage;
        if(!rage){ return text; }

        const replaceAtLevel=(targetLevel)=>{
            const values=getV140RageValues(targetLevel);
            [
                "爆擊率／爆擊傷害 +"+values.chance+"%",
                "我方爆擊率與爆擊傷害 +"+values.chance+"%"
            ].forEach(oldText=>{
                text=text.split(oldText).join(
                    (oldText.startsWith("我方")?"我方":"")+
                    "爆擊率 +"+values.chance+"%、爆擊傷害 +"+
                    values.damage+"%"
                );
            });
        };

        if(skill&&skill.id==="rage"&&numeric(level)>0){
            replaceAtLevel(level);
        }
        else{
            for(let lv=1;lv<=(rage.maxLevel||5);lv++){
                replaceAtLevel(lv);
            }
        }
        return text;
    }

    function refreshUIAfterSpCorrection(){
        try{
            if(typeof updateUI==="function"){
                updateUI();
            }
        }catch(error){
            console.error("V140 更新SP顯示失敗：",error);
        }
    }

    function runPlayerSkillWithV140Context(skill,caster,stats,execute){
        if(!skill||!caster||!stats){
            return execute();
        }

        const previousContext=statusSkillContext;
        const context={
            skill:skill,
            physicalAttack:numeric(stats.attack),
            intelligence:numeric(stats.intelligence),
            spAfterCost:null
        };
        statusSkillContext=context;

        const isLifesteal=Array.isArray(skill.lifestealPercentByLevel);
        const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
        const previousBadge=typeof showSkillNameBadge==="function"?showSkillNameBadge:null;

        if(isLifesteal&&previousLog){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                args[0]=hpOnlyBattleLogText(message);
                return previousLog.apply(this,args);
            };
        }

        if(isLifesteal&&previousBadge){
            showSkillNameBadge=function(){
                if(context.spAfterCost===null){
                    context.spAfterCost=numeric(caster.sp);
                }
                return previousBadge.apply(this,arguments);
            };
        }

        let result;
        try{
            result=execute();
        }finally{
            if(isLifesteal&&previousBadge){
                showSkillNameBadge=previousBadge;
            }
            if(isLifesteal&&previousLog){
                addBattleLog=previousLog;
            }
            statusSkillContext=previousContext;

            if(
                isLifesteal&&
                context.spAfterCost!==null&&
                numeric(caster.sp)>context.spAfterCost
            ){
                caster.sp=context.spAfterCost;
                refreshUIAfterSpCorrection();
            }
        }
        return result;
    }

    const previousCastDamageSkill=castDamageSkill;
    castDamageSkill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getMainCharacterStats==="function"
            ? getMainCharacterStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player!=="undefined"?player:null,
            stats,
            ()=>previousCastDamageSkill.apply(this,arguments)
        );
    };

    const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
    castSecondaryCharacterSkill=function(characterIndex,skillId){
        const skill=skillDatabase[skillId];
        const character=typeof getPartyCharacterByIndex==="function"
            ? getPartyCharacterByIndex(characterIndex)
            : null;
        const stats=typeof getPartyBattleStats==="function"
            ? getPartyBattleStats(characterIndex)
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            character,
            stats,
            ()=>previousCastSecondaryCharacterSkill.apply(this,arguments)
        );
    };

    const previousCastPlayer2Skill=castPlayer2Skill;
    castPlayer2Skill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getPlayer2BattleStats==="function"
            ? getPlayer2BattleStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player2!=="undefined"?player2:null,
            stats,
            ()=>previousCastPlayer2Skill.apply(this,arguments)
        );
    };

    function getMonsterPhysicalAttack(monster){
        if(!monster){ return 0; }
        const reduction=typeof getStatDownPercentFor==="function"
            ? numeric(getStatDownPercentFor(monster,"attack"))
            : 0;
        return Math.max(0,numeric(monster.attack)*(1-reduction/100));
    }

    function getMonsterIntelligence(monster){
        if(!monster){ return 0; }
        if(typeof getMonsterEffectiveAbilityPoints==="function"){
            return numeric(getMonsterEffectiveAbilityPoints(monster,"intelligence"));
        }
        return numeric(monster.intelligencePoints);
    }

    function findSkillByName(name){
        return Object.keys(skillDatabase)
            .map(id=>skillDatabase[id])
            .find(skill=>skill&&skill.name===name)||null;
    }

    /* 技能與結界符共用規則：DOT 不抵擋、也不消耗次數。 */
    const previousTickStatusEffects=tickStatusEffects;
    tickStatusEffects=function(){
        const previousHasActiveBuff=hasActiveBuff;
        hasActiveBuff=function(character,buffType){
            if(buffType!=="barrier"){
                return previousHasActiveBuff.apply(this,arguments);
            }
            return false;
        };

        try{
            return previousTickStatusEffects.apply(this,arguments);
        }finally{
            hasActiveBuff=previousHasActiveBuff;
        }
    };

    const previousProcessSingleMonsterAttack=processSingleMonsterAttack;
    processSingleMonsterAttack=function(monsterIndex){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster){
            return previousProcessSingleMonsterAttack.apply(this,arguments);
        }

        const previousContext=statusSkillContext;
        const previousBarrierContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        const context={
            skill:null,
            physicalAttack:getMonsterPhysicalAttack(monster),
            intelligence:getMonsterIntelligence(monster),
            spAfterCost:null
        };
        statusSkillContext=�my��$z{-���jם       const base=card.dataset.v154BaseBattleArtwork||"";
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
        if(item.setId){ return "orange"; }
        const tier=String(item.tierKey||"").toLowerCase();
        if(TIER_TO_QUALITY[tier]){ return TIER_TO_QUALITY[tier]; }
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
        if(item.type==="chest"&&getChestOpenOnce(item)){
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

function fivePriority(indexes){const list=(indexes||[]).filter(Number.isInteger);if(list.length!==5)return null;let rows=null;try{if(typeof window.v148GetFormationRows==="function")rows=window.v148GetFormationRows(list);else if(typeof window.v138GetFormationRows==="function")rows=window.v138GetFormationRows(list)}catch(_){}const row=Array.isArray(rows)&&Array.isArray(rows[0])&&rows[0].length===5?rows[0].slice():list.slice();return [row[2],row[1],row[3],row[0],row[4]].filter(Number.isInteger);}
if(typeof window.v148GetAutoTargetPriority==="function"){const old=window.v148GetAutoTargetPriority;window.v148GetAutoTargetPriority=function(indexes){return fivePriority(indexes)||old.apply(this,arguments)}}
window.v17351FiveEnemyAutoTargetPriority=fivePriority;

/* V174 battle presentation owner.
   Keep the proven 10-seat geometry and action/turn UI untouched. Only the
   visual shell inside each existing combat slot changes: the card frame is
   transparent, artwork gets its own presentation layer, HP/SP text shows the
   current value only, and the already-existing lunge classes animate artwork
   instead of dragging the HUD bars with the portrait. */
function ensureBattlePresentationStyles(){
    if(document.getElementById("v174-cardless-battle-style"))return;
    const style=document.createElement("style");
    style.id="v174-cardless-battle-style";
    style.textContent=`
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit,
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit{
    border:0!important;outline:0!important;box-shadow:none!important;
    background-color:transparent!important;background-image:none!important;
    isolation:isolate!important;
    transition-property:opacity!important;transition-duration:.15s!important;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art{
    position:absolute!important;inset:0!important;z-index:1!important;
    display:block!important;pointer-events:none!important;
    background-repeat:no-repeat!important;background-color:transparent!important;
    transform-origin:50% 82%!important;will-change:transform,filter!important;
    animation:v174BattleIdle 3.4s ease-in-out infinite!important;
    filter:drop-shadow(0 7px 4px rgba(0,0,0,.52));
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.v174-battle-art{
    inset:-2px -2px 30px!important;
    background-size:contain!important;background-position:center bottom!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.hp-bar{
    position:absolute!important;left:50%!important;bottom:13px!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.sp-bar{
    position:absolute!important;left:50%!important;bottom:0!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-hp{
    position:absolute!important;left:50%!important;bottom:13px!important;
    display:block!important;visibility:visible!important;opacity:1!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-sp{
    position:absolute!important;left:50%!important;bottom:0!important;
    display:block!important;visibility:visible!important;opacity:1!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.battle-player-id{
    z-index:20!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.v174-battle-art{
    inset:-5px!important;
    background-size:cover!important;background-position:center center!important;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art::after{
    content:"";position:absolute;left:50%;bottom:-2px;width:66%;height:10px;
    border-radius:50%;background:rgba(0,0,0,.42);filter:blur(2px);
    transform:translateX(-50%);pointer-events:none;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art~*{z-index:6;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .hp-bar,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .sp-bar,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .monster-hp,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .monster-sp{z-index:20!important;}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>img.v162-abyss-battle-portrait-art{
    opacity:0!important;pointer-events:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.active-turn::after{
    border:0!important;background:none!important;box-shadow:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.ally-targetable{box-shadow:none!important;}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit.target{
    border:0!important;box-shadow:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.active-turn>.v174-battle-art,
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit.target>.v174-battle-art{
    filter:drop-shadow(0 7px 4px rgba(0,0,0,.52)) drop-shadow(0 0 7px var(--v138-element-glow,rgba(255,220,120,.7)));
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-up{animation:none!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-down{animation:none!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-up>.v174-battle-art{animation:v174BattleLungeUp .45s ease!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-down>.v174-battle-art{animation:v174BattleLungeDown .45s ease!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art.v174-hit-shake{animation:v174BattleHitShake .28s ease!important;}
@keyframes v174BattleIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.015)}}
@keyframes v174BattleLungeUp{0%,100%{transform:translateY(0) scale(1)}38%{transform:translateY(-13px) scale(1.035)}68%{transform:translateY(-5px) scale(1.015)}}
@keyframes v174BattleLungeDown{0%,100%{transform:translateY(0) scale(1)}38%{transform:translateY(13px) scale(1.035)}68%{transform:translateY(5px) scale(1.015)}}
@keyframes v174BattleHitShake{0%,100%{transform:translate(0,0)}18%{transform:translate(-4px,1px)}36%{transform:translate(4px,-1px)}54%{transform:translate(-3px,0)}72%{transform:translate(2px,1px)}}
@media (prefers-reduced-motion:reduce){
    #game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art{animation:none!important;}
}
`;
    document.head.appendChild(style);
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
    ensureBattlePresentationStyles();
    document.querySelectorAll("#battlePage .battle-player").forEach(card=>syncUnitArtwork(card,"player"));
    document.querySelectorAll("#battlePage .battle-monster").forEach(card=>syncUnitArtwork(card,"monster"));
    syncResourceNumbers();
}
function shakeArtForPopup(node){
    if(!(node instanceof Element))return;
    const popups=node.matches?.(".damage-popup.hp-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup.hp-popup")||[]);
    popups.forEach(popup=>{
        const card=popup.closest(".battle-player,.battle-monster");
        const art=card?.querySelector(":scope > .v174-battle-art");
        if(!art)return;
        art.classList.remove("v174-hit-shake");void art.offsetWidth;art.classList.add("v174-hit-shake");
        setTimeout(()=>art.classList.remove("v174-hit-shake"),300);
    });
}

/* V173.51: the EXP-row metadata is injected by V133 after the V131 list render.
   A later list rerender could replace those rows and momentarily/permanently remove
   the "目前 EXP / 升下一級需求" line. Decorate synchronously after every render
   so the requirement never disappears while the EXP pool is open. */
function decorateExpRows(){
    if(typeof window.v173DecorateExpPoolDistributionUi==="function"){
        window.v173DecorateExpPoolDistributionUi();
    }
}
if(typeof renderExpDistributeList==="function"&&!renderExpDistributeList.__v17351ExpStable){
    const previousRenderExpDistributeList=renderExpDistributeList;
    const stableRender=function(){
        const result=previousRenderExpDistributeList.apply(this,arguments);
        decorateExpRows();
        return result;
    };
    stableRender.__v17351ExpStable=true;
    renderExpDistributeList=stableRender;
    window.renderExpDistributeList=stableRender;
}
function ensureExpRowsVisible(){
    const list=document.getElementById("expDistributeList");
    if(!list)return;
    const rows=Array.from(list.querySelectorAll(".v131-exp-row"));
    if(rows.length&&rows.some(row=>!row.querySelector(".v173-exp-row-meta")))decorateExpRows();
}
decorateExpRows();

function syncManagement(){
    /*
       VFX lifecycle belongs exclusively to V142/V143. This management QA
       observer used to hide #v143-skill-stage every 300ms when its broad
       non-battle heuristic became true. During a terminal hit battleActive
       can change before the last visual finishes, which made the final skill
       name/damage appear while the actual Sprite/VFX vanished.
       Never write VFX visibility from this subsystem.
    */
    document.body.classList.remove("v17351-management-open");
    document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{
        if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice");
    });
    ensureExpRowsVisible();
    syncBattlePresentation();
}
window.v17351SyncManagement=syncManagement;

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';document.body.appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

const observer=new MutationObserver(mutations=>{syncManagement();mutations.forEach(record=>record.addedNodes.forEach(shakeArtForPopup));});
observer.observe(document.body,{subtree:true,childList:true});
setInterval(syncManagement,300);
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
