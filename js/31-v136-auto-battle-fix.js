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
