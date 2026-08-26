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
