from pathlib import Path
import re

OLD="173.41"
NEW="173.42"
BASE_SHA="8bd904c3a4949e1dbe4066d34a194f3d4a690cd9"
RELEASE_ENTRIES=[
    "css/00-main.css",
    "css/19-stage-v54-main-city-moderate-native-scale.css",
    "js/00-main.js",
    "js/16-stage-v54-main-city-runtime.js",
    "js/19-stage-v78-character-inventory-runtime.js",
    "js/20-anonymous-20.js",
]

def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)

def rx_once(text, pattern, repl, label, flags=0):
    new,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return new

# ------------------------------------------------------------------
# 1) Core battle-log bridge: preserve Element Box recovery notices
#    across a battle-info clear so the next battle still shows them.
# ------------------------------------------------------------------
p=Path("js/00-main.js")
s=p.read_text()
old='''function clearBattleLog(){\n\n    $("battleInfo")\n        .innerHTML="";'''
new='''function clearBattleLog(){\n\n    $("battleInfo")\n        .innerHTML="";\n\n    /* V173.42: Element Box can use potions while no battle is running.\n       Carry those notices into the next battle-info panel exactly once. */\n    const pendingElementBoxNotices=\n        typeof window!=="undefined"&&Array.isArray(window.v17342PendingBattleNotices)\n            ? window.v17342PendingBattleNotices.splice(0)\n            : [];\n    pendingElementBoxNotices.forEach(message=>addBattleLog(message));'''
s=once(s,old,new,"clearBattleLog notice bridge")
p.write_text(s)

# ------------------------------------------------------------------
# 2) Wild EXP / gold progression owner.
#    Existing battle EXP becomes x3; monster gold becomes x5.
#    Beginner forest is per defeated monster instead of flat per battle.
# ------------------------------------------------------------------
p=Path("js/25-v131-fix-batch.js")
s=p.read_text()
s=once(s,
'''    const ELEMENT_BOX_EXP_RATIO=0.70;\n    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;''',
'''    const ELEMENT_BOX_EXP_RATIO=0.70;\n    const V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3;\n    const V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5;\n    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;''',
"global reward multipliers")

anchor='''    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;\n\n    function getMonsterExpRankMultiplier(monster){'''
replacement='''    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;\n\n    function getBeginnerForestMonsterExpUnit(){\n        /* V173.40 targeted ~20 battles using one flat battle reward.\n           V173.42 keeps that old 3-monster reference value, but pays per\n           defeated monster so 1 / 2 / 3 monsters are no longer identical. */\n        return Math.max(1,Math.ceil(getBeginnerForestBattleExp()/3));\n    }\n    window.v17342GetBeginnerForestMonsterExpUnit=getBeginnerForestMonsterExpUnit;\n\n    function getMonsterExpRankMultiplier(monster){'''
s=once(s,anchor,replacement,"beginner per-monster helper")

s=once(s,
'''            let finalExp=Math.floor(rankAdjustedExp*V131_EXP_MULTIPLIER);''',
'''            let finalExp=Math.floor(\n                rankAdjustedExp*V131_EXP_MULTIPLIER*V17342_GLOBAL_EXP_REWARD_MULTIPLIER\n            );''',
"battle EXP x3")

old='''            if(isBeginnerForestBattle){\n                finalExp=getBeginnerForestBattleExp();\n            }'''
new='''            if(isBeginnerForestBattle){\n                const beginnerMonsterUnits=currentBattleMonsters.reduce((total,index)=>{\n                    const monster=monsters[index];\n                    return monster ? total+getMonsterExpRankMultiplier(monster) : total;\n                },0);\n                finalExp=Math.max(1,Math.round(\n                    getBeginnerForestMonsterExpUnit()*\n                    Math.max(1,beginnerMonsterUnits)*\n                    V17342_GLOBAL_EXP_REWARD_MULTIPLIER\n                ));\n            }'''
s=once(s,old,new,"beginner per-monster EXP")

old='''    if(typeof awardMonsterGoldDrop==="function"){\n        const originalAwardMonsterGoldDrop=awardMonsterGoldDrop;\n        awardMonsterGoldDrop=function(){\n            const amount=originalAwardMonsterGoldDrop.apply(this,arguments);\n            recordElementBoxMonsterGold(amount);\n            return amount;\n        };\n    }'''
new='''    if(typeof awardMonsterGoldDrop==="function"){\n        const originalAwardMonsterGoldDrop=awardMonsterGoldDrop;\n        awardMonsterGoldDrop=function(){\n            const baseAmount=Math.max(0,Number(originalAwardMonsterGoldDrop.apply(this,arguments))||0);\n            const bonusAmount=Math.max(0,Math.floor(baseAmount*(V17342_GLOBAL_GOLD_REWARD_MULTIPLIER-1)));\n            if(bonusAmount>0){\n                gold+=bonusAmount;\n                if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }\n            }\n            const amount=baseAmount+bonusAmount;\n            recordElementBoxMonsterGold(amount);\n            return amount;\n        };\n    }'''
s=once(s,old,new,"monster gold x5")
p.write_text(s)

# ------------------------------------------------------------------
# 3) EXP dungeon x3 (11% -> 33%).
# ------------------------------------------------------------------
p=Path("js/27-v132-content-expansion.js")
s=p.read_text()
s=once(s,"    const EXP_DUNGEON_REWARD_RATIO=0.11;","    const EXP_DUNGEON_REWARD_RATIO=0.33;","EXP dungeon ratio")
p.write_text(s)

# ------------------------------------------------------------------
# 4) Offline EXP x3 after the existing highest-level multiplier.
# ------------------------------------------------------------------
p=Path("js/34-v141-core-systems.js")
s=p.read_text()
s=once(s,
"pendingOfflineExp=before+Math.round(baseGain*getOfflineLevelMultiplier());",
"pendingOfflineExp=before+Math.round(baseGain*getOfflineLevelMultiplier()*3);",
"offline EXP x3")
p.write_text(s)

# ------------------------------------------------------------------
# 5) Backpack potion use, reward-table scaling, EXP-pool notification.
# ------------------------------------------------------------------
p=Path("js/35-v141-ui-battle.js")
s=p.read_text()

insert='''\n    /* V173.42 — backpack potion use follows the currently selected backpack character. */\n    function syncInventoryPotionUseButton(item,slotIndex){\n        const buttons=document.querySelector("#itemModal .item-modal-buttons");\n        if(!buttons){ return; }\n        let button=document.getElementById("v17342InventoryPotionUse");\n        const definition=item&&typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;\n        if(!definition){\n            if(button){ button.remove(); }\n            return;\n        }\n        if(!button){\n            button=document.createElement("button");\n            button.id="v17342InventoryPotionUse";\n            button.type="button";\n            button.className="item-modal-button v17342-inventory-potion-use";\n            buttons.insertBefore(button,buttons.firstChild||null);\n        }\n        button.textContent="使用";\n        button.onclick=()=>window.v17342UseInventoryPotion(slotIndex);\n    }\n\n    window.v17342UseInventoryPotion=function(slotIndex){\n        const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;\n        const definition=item&&typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;\n        const character=typeof getBackpackCharacter==="function"?getBackpackCharacter(inventoryCharacterIndex):null;\n        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(inventoryCharacterIndex):null;\n        if(!definition||!character||!stats){ return false; }\n        const resource=definition.resource;\n        const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);\n        const currentValue=Number(character[resource])||0;\n        if(!(maxValue>0)||currentValue>=maxValue){\n            alert((character.id||"角色")+(resource==="hp"?" HP":" SP")+"目前不需要補充。");\n            return false;\n        }\n        if(typeof consumePotionFromInventory!=="function"||!consumePotionFromInventory(definition.id,1)){\n            alert(definition.name+"數量不足。");\n            return false;\n        }\n        const planned=definition.recoveryPercent>=100\n            ?maxValue-currentValue\n            :Math.max(1,Math.round(maxValue*Number(definition.recoveryPercent||0)/100));\n        const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));\n        character[resource]=Math.min(maxValue,currentValue+recovered);\n        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }\n        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }\n        if(typeof renderInventory==="function"){ renderInventory(); }\n        if(typeof updateUI==="function"){ updateUI(); }\n        if(typeof saveGame==="function"){ saveGame(); }\n        if(typeof closeItemModal==="function"){ closeItemModal(); }\n        alert((character.id||"角色")+"使用"+definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。");\n        return true;\n    };\n\n'''
s=once(s,'    if(typeof openItemModal==="function"){',insert+'    if(typeof openItemModal==="function"){',"inventory potion insertion")
s=once(s,
'''            syncDecomposeButton(item,slotIndex);\n            return result;''',
'''            syncDecomposeButton(item,slotIndex);\n            syncInventoryPotionUseButton(item,slotIndex);\n            return result;''',
"potion modal sync")
s=once(s,
'''            syncDecomposeButton(null,null);\n            return result;''',
'''            syncDecomposeButton(null,null);\n            syncInventoryPotionUseButton(null,null);\n            return result;''',
"equipped modal clears potion use")

# Scale daily/commission/achievement configured rewards in one place; scale milestone table too.
anchor='''    const milestoneRewards={\n        daily:{20:{gold:20},40:{gold:30,exp:20},60:{gold:40},80:{gold:50,exp:30},100:{gold:80,exp:50}},\n        commission:{20:{gold:50},40:{gold:75,exp:30},60:{gold:100},80:{gold:150,exp:70},100:{gold:250,exp:120}}\n    };'''
repl=anchor+'''\n    const v17342ScaledProgressRewards=new WeakSet();\n    function v17342ScaleReward(reward){\n        if(!reward||typeof reward!=="object"||v17342ScaledProgressRewards.has(reward)){ return reward; }\n        if(Number.isFinite(Number(reward.exp))){ reward.exp=Math.round(Number(reward.exp)*3); }\n        if(Number.isFinite(Number(reward.gold))){ reward.gold=Math.round(Number(reward.gold)*5); }\n        v17342ScaledProgressRewards.add(reward);\n        return reward;\n    }\n    function v17342ScaleProgressRewards(){\n        [\n            typeof dailyQuestDefinitions!=="undefined"?dailyQuestDefinitions:[],\n            typeof commissionQuestDefinitions!=="undefined"?commissionQuestDefinitions:[],\n            typeof achievementDefinitions!=="undefined"?achievementDefinitions:[]\n        ].forEach(list=>(list||[]).forEach(item=>v17342ScaleReward(item&&item.reward)));\n        Object.values(milestoneRewards).forEach(table=>Object.values(table).forEach(v17342ScaleReward));\n    }\n    v17342ScaleProgressRewards();'''
s=once(s,anchor,repl,"progress reward x3/x5")

s=s.replace('reward:"當前升級需求平均值的11% EXP"','reward:"當前升級需求平均值的33% EXP"')

old='''        const hasAchievement=achievementDefinitions.some(item=>item.check()&&!achievementState[item.id]);\n        const announcementUnread=localStorage.getItem(ANNOUNCEMENT_READ_KEY)!=="1";'''
new='''        const hasAchievement=achievementDefinitions.some(item=>item.check()&&!achievementState[item.id]);\n        const hasExpLevelUp=typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().some(index=>{\n            const character=getPartyCharacterByIndex(index);\n            const maxLevel=Math.max(1,Number(window.v133MaxLevel)||100);\n            return !!(character&&Number(character.level)<maxLevel&&Number(sharedExp)>=Math.max(1,Number(character.expNext)||1));\n        });\n        const announcementUnread=localStorage.getItem(ANNOUNCEMENT_READ_KEY)!=="1";'''
s=once(s,old,new,"exp pool red dot state")
old='''        setNotificationDot(document.getElementById("homeIconAchievement")?.parentElement,hasAchievement,"成就可領取");\n        setNotificationDot(document.getElementById("homeIconOfflineExp")?.parentElement,pendingOfflineExp>0,"有離線經驗可領取");'''
new='''        setNotificationDot(document.getElementById("homeIconAchievement")?.parentElement,hasAchievement,"成就可領取");\n        setNotificationDot(document.getElementById("homeIconCharacter")?.parentElement,hasExpLevelUp,"經驗池可讓角色升級");\n        setNotificationDot(document.getElementById("homeHudExpValue")?.parentElement,hasExpLevelUp,"經驗池可讓角色升級");\n        setNotificationDot(document.getElementById("homeIconOfflineExp")?.parentElement,pendingOfflineExp>0,"有離線經驗可領取");'''
s=once(s,old,new,"exp pool red dots")
p.write_text(s)

# ------------------------------------------------------------------
# 6) Abyss: map battle-info region + 9:16 cover separated from enter button;
#    final chest EXP/gold follows global reward increase.
# ------------------------------------------------------------------
p=Path("js/36-v141-content-systems.js")
s=p.read_text()
s=once(s,
'''    function renderAbyss(){''',
'''    function abyssBattleInfoMarkup(){\n        const source=document.getElementById("battleInfo");\n        const html=source&&String(source.innerHTML||"").trim();\n        return html||'<div class="v17342-abyss-battle-empty">尚無戰鬥資訊</div>';\n    }\n\n    function renderAbyss(){''',
"abyss battle info helper")
old='''            '<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+abyssState.x+'%;top:'+abyssState.y+'%"><span></span><small>玩家</small></div></div></div>';'''
new='''            '<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+abyssState.x+'%;top:'+abyssState.y+'%"><span></span><small>玩家</small></div></div>'+\n            '<section class="v17342-abyss-battle-info" aria-label="戰鬥資訊"><b>戰鬥資訊</b><div>'+abyssBattleInfoMarkup()+'</div></section></div>';'''
s=once(s,old,new,"abyss map battle info markup")
s=once(s,
'''            const exp=Math.max(100,Math.floor(avgNeed*.15));\n            const rewardGold=2000+window.v141GetHighestCharacterLevel()*50;''',
'''            const exp=Math.max(300,Math.floor(avgNeed*.45));\n            const rewardGold=(2000+window.v141GetHighestCharacterLevel()*50)*5;''',
"abyss reward x3/x5")
p.write_text(s)

# ------------------------------------------------------------------
# 7) Element Box recovery: logs persist, active idle monitoring, return-home.
# ------------------------------------------------------------------
p=Path("js/45-v154-dev-fixes.js")
s=p.read_text()
anchor='''    function finishAutoRecovery(){'''
helper='''    function logElementBoxRecovery(message){\n        const text=String(message||"");\n        if(!text){ return; }\n        if(typeof addBattleLog==="function"){ addBattleLog(text); }\n        if(!(typeof battleActive!=="undefined"&&battleActive)&&typeof window!=="undefined"){\n            window.v17342PendingBattleNotices=Array.isArray(window.v17342PendingBattleNotices)\n                ?window.v17342PendingBattleNotices:[];\n            window.v17342PendingBattleNotices.push(text);\n            if(window.v17342PendingBattleNotices.length>12){ window.v17342PendingBattleNotices.shift(); }\n        }\n    }\n\n    function finishAutoRecovery(){'''
s=once(s,anchor,helper,"element box log helper")
s=once(s,"        let consumed=0;","        let consumed=0;\n        let shouldReturnToCity=false;","return flag")
old='''                    if(!definition||!consumePotionFromInventory(potionId,1)){ return; }'''
new='''                    if(!definition||!consumePotionFromInventory(potionId,1)){\n                        if(config.returnToCityWhenEmpty){ shouldReturnToCity=true; }\n                        return;\n                    }'''
s=once(s,old,new,"return when potion unavailable")
old='''                    if(typeof addBattleLog==="function"){\n                        addBattleLog(\n                            "元素匣為"+(character.id||"角色")+"自動使用"+\n                            definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。"\n                        );\n                    }'''
new='''                    logElementBoxRecovery(\n                        "元素匣為"+(character.id||"角色")+"自動使用"+\n                        definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。"\n                    );'''
s=once(s,old,new,"element box potion battle log")
old='''        if(consumed&&typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }\n        return consumed;'''
new='''        if(consumed&&typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }\n        if(shouldReturnToCity&&elementBoxActive){\n            logElementBoxRecovery("元素匣偵測到補品不足，已停止巡練並返回主城。");\n            if(typeof window.v169StopElementBox==="function"){ window.v169StopElementBox(); }\n            else if(typeof toggleAutoBattle==="function"&&typeof autoBattle!=="undefined"&&autoBattle){ toggleAutoBattle(); }\n            if(typeof showPage==="function"){ showPage("home"); }\n        }\n        return consumed;'''
s=once(s,old,new,"element box return city action")
anchor='''    syncElementBoxPrimaryButton();\n    syncAbyssPortraits();\n})();'''
repl='''    if(typeof setInterval==="function"){\n        setInterval(()=>{\n            if(\n                isElementBoxRecoveryActive()&&\n                !(typeof battleActive!=="undefined"&&battleActive)\n            ){\n                const consumed=finishAutoRecovery();\n                if(consumed&&typeof updateUI==="function"){ updateUI(); }\n                if(consumed&&typeof saveGame==="function"){ saveGame(); }\n            }\n        },1000);\n    }\n    syncElementBoxPrimaryButton();\n    syncAbyssPortraits();\n})();'''
s=once(s,anchor,repl,"idle recovery interval")
p.write_text(s)

# ------------------------------------------------------------------
# 8) Element Box settings owner rewritten in-place: per-character action,
#    shared HP/SP/return settings, active-session lock + popup.
# ------------------------------------------------------------------
p=Path("js/49-v169-element-box-settings.js")
p.write_text(r'''/* =====================================================
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

    if(typeof switchAutoSettingsCharacter==="function"){
        const previous=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(){
            if(elementBoxIsActive()){ notifyLocked(); return false; }
            const result=previous.apply(this,arguments);
            syncSharedRecoveryForm();
            if(typeof saveGame==="function"){ saveGame(); }
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

        CONTROL_IDS.forEach(id=>{ const field=document.getElementById(id); if(field){ field.disabled=active; } });
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
        syncElementBoxSettingControls();
        if(elementBoxIsActive()){ setTimeout(notifyLocked,0); }
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
    syncElementBoxSettingControls();
})();
''')

# ------------------------------------------------------------------
# 9) Home city DOM: utilities become row 4 of the existing side rails.
#    Element Box shared recovery section is visually explicit.
# ------------------------------------------------------------------
p=Path("index.html")
s=p.read_text()
utility='''\n    <div class="home-utility-actions" aria-label="其他功能">\n        <button type="button" class="home-card home-card-utility" onclick="openHomeFeature('offlineExp')" aria-label="離線經驗">\n            <span id="homeIconOfflineExp" class="home-card-icon" style="background-image:url(assets/ui/home-offline-exp.png);"></span>\n            <span class="home-card-label">離線經驗</span>\n        </button>\n\n        <button type="button" class="home-card home-card-utility" onclick="openHomeFeature('system')" aria-label="系統">\n            <span id="homeIconSystem" class="home-card-icon" style="background-color:#000;background-image:url(assets/ui/home-system.png);"></span>\n            <span class="home-card-label">系統</span>\n        </button>\n    </div>'''
if utility not in s: raise SystemExit("home utility block not found")
s=s.replace(utility,"",1)
insert_after='''        <button type="button" class="home-card home-card-secondary" onclick="openHomeFeature('announcement')" aria-label="公告">\n            <span id="homeIconAnnouncement" class="home-card-icon" style="background-image:url(assets/ui/home-announcement.png);"></span>\n            <span class="home-card-label">公告</span>\n        </button>'''
extra='''\n\n        <button type="button" class="home-card home-card-secondary" onclick="openHomeFeature('offlineExp')" aria-label="離線經驗">\n            <span id="homeIconOfflineExp" class="home-card-icon" style="background-image:url(assets/ui/home-offline-exp.png);"></span>\n            <span class="home-card-label">離線經驗</span>\n        </button>\n\n        <button type="button" class="home-card home-card-secondary" onclick="openHomeFeature('system')" aria-label="系統">\n            <span id="homeIconSystem" class="home-card-icon" style="background-color:#000;background-image:url(assets/ui/home-system.png);"></span>\n            <span class="home-card-label">系統</span>\n        </button>'''
s=once(s,insert_after,insert_after+extra,"home utility row insertion")

s=once(s,'<div class="auto-threshold-grid">','''<section class="v17342-element-box-shared" aria-label="三名角色共用設定">\n    <div class="v17342-element-box-shared-head"><b>共用設定</b><span>三名角色共用</span></div>\n<div class="auto-threshold-grid">''',"shared settings start")
s=once(s,
'''                <small>戰鬥結束後低於門檻時使用補品</small>''',
'''                <small>低於門檻時自動使用補品</small>''',
"HP shared copy")
s=once(s,
'''                <small>戰鬥結束後低於門檻時使用補品</small>''',
'''                <small>低於門檻時自動使用補品</small>''',
"SP shared copy")
s=once(s,
'''</label>\n\n<div class="auto-settings-actions">''',
'''</label>\n</section>\n\n<div class="auto-settings-actions">''',
"shared settings end")

# Release/cache version.
s=once(s,f'<title>四象江湖傳 V{OLD}</title>',f'<title>四象江湖傳 V{NEW}</title>',"title")
s=once(s,f'id="v{OLD}-home-version-badge-style"',f'id="v{NEW}-home-version-badge-style"',"badge style")
s=once(s,f'aria-label="目前版本 V{OLD}"',f'aria-label="目前版本 V{NEW}"',"badge aria")
s=once(s,f'>V{OLD}</div>',f'>V{NEW}</div>',"badge text")
for entry in RELEASE_ENTRIES:
    s=once(s,f'{entry}?v={OLD}',f'{entry}?v={NEW}',f'release entry {entry}')
p.write_text(s)

# ------------------------------------------------------------------
# 10) CSS owners.
# ------------------------------------------------------------------
p=Path("css/00-main.css")
s=p.read_text()
s=once(s,"grid-template-rows:repeat(3,82px);","grid-template-rows:repeat(4,82px);","home side rail rows")
s=once(s,"min-height:256px;","min-height:343px;","home side rail height")
s=s.replace('.home-card-secondary:nth-child(3),\n.home-card-secondary:nth-child(5){margin-inline-start:0;}',
            '.home-card-secondary:nth-child(3),\n.home-card-secondary:nth-child(5),\n.home-card-secondary:nth-child(7){margin-inline-start:0;}')
s=s.replace('.home-card-secondary:nth-child(4),\n.home-card-secondary:nth-child(6){margin-inline-end:0;}',
            '.home-card-secondary:nth-child(4),\n.home-card-secondary:nth-child(6),\n.home-card-secondary:nth-child(8){margin-inline-end:0;}')
p.write_text(s)

p=Path("css/48-v169-element-box-settings.css")
s=p.read_text()+r'''

/* V173.42 — shared recovery section and active-session edit lock. */
#autoBattleSettingsPanel .v17342-element-box-shared{
    display:block;
    margin:8px 0 0;
    padding:9px;
    border:1px solid rgba(193,144,67,.62);
    border-radius:11px;
    background:linear-gradient(160deg,rgba(42,30,18,.92),rgba(10,9,7,.96));
}
#autoBattleSettingsPanel .v17342-element-box-shared-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-bottom:7px;
    color:#f2ce83;
}
#autoBattleSettingsPanel .v17342-element-box-shared-head b{font-size:14px;}
#autoBattleSettingsPanel .v17342-element-box-shared-head span{font-size:11px;color:#bba57a;}
#autoBattleSettingsPanel .v17342-element-box-lock-notice{
    margin:7px 0;
    padding:8px 10px;
    border:1px solid rgba(216,89,59,.72);
    border-radius:9px;
    color:#ffd7b8;
    background:rgba(80,25,17,.86);
    font-size:12px;
    font-weight:900;
    text-align:center;
}
#autoBattleSettingsPanel.v17342-settings-locked select:disabled,
#autoBattleSettingsPanel.v17342-settings-locked input:disabled{
    opacity:.48;
    filter:saturate(.45);
}
#autoBattleSettingsPanel.v17342-settings-locked #autoBattleButton:disabled{
    opacity:.55;
}
'''
p.write_text(s)

p=Path("css/46-v154-dev-fixes.css")
s=p.read_text()
old=r'''#game-stage #dungeonPage.v146-abyss-intro-mode .v141-abyss-intro:not(.complete){
    align-items:center !important;
    justify-content:flex-end !important;
    padding:14px 18px 22px !important;
    background:
        linear-gradient(180deg,transparent 0 76%,rgba(3,3,3,.76) 100%),
        url("../assets/dungeons/abyss/abyss-cover.webp") center 35% / cover no-repeat !important;
}'''
new=r'''#game-stage #dungeonPage.v146-abyss-intro-mode .v141-abyss-intro:not(.complete){
    align-items:center !important;
    justify-content:flex-start !important;
    gap:8px !important;
    padding:8px 18px 14px !important;
    background:#080705 !important;
}
#game-stage #dungeonPage.v146-abyss-intro-mode .v141-abyss-intro:not(.complete)::before{
    content:"";
    display:block;
    width:min(100%,336px);
    max-height:calc(100% - 58px);
    aspect-ratio:9/16;
    flex:1 1 auto;
    border:1px solid rgba(184,134,65,.68);
    border-radius:10px;
    background:url("../assets/dungeons/abyss/abyss-cover.webp") center 35% / cover no-repeat;
    box-shadow:0 6px 18px rgba(0,0,0,.58);
}'''
s=once(s,old,new,"abyss cover separated")
s=once(s,
'''#game-stage #dungeonPage.v146-abyss-active .v141-abyss-map{\n    width:100% !important;\n    height:100% !important;\n    min-height:0 !important;\n}''',
'''#game-stage #dungeonPage.v146-abyss-active .v141-abyss-map{\n    width:100% !important;\n    height:auto !important;\n    min-height:0 !important;\n    flex:1 1 auto !important;\n}\n#game-stage #dungeonPage.v146-abyss-active .v141-abyss-shell{\n    display:flex !important;\n    flex-direction:column !important;\n    min-height:0 !important;\n}\n#game-stage #dungeonPage.v146-abyss-active .v17342-abyss-battle-info{\n    flex:0 0 82px;\n    min-height:82px;\n    padding:5px 8px 7px;\n    overflow:hidden;\n    border-top:1px solid rgba(190,142,65,.72);\n    background:linear-gradient(180deg,rgba(24,17,10,.96),rgba(7,6,5,.98));\n    color:#e9dcc0;\n}\n#game-stage #dungeonPage.v146-abyss-active .v17342-abyss-battle-info > b{\n    display:block;\n    margin-bottom:3px;\n    color:#f1c66f;\n    font-size:12px;\n}\n#game-stage #dungeonPage.v146-abyss-active .v17342-abyss-battle-info > div{\n    height:54px;\n    overflow-y:auto;\n    font-size:10px;\n    line-height:1.35;\n    scrollbar-width:thin;\n}\n#game-stage #dungeonPage.v146-abyss-active .v17342-abyss-battle-empty{color:#9f947d;}''',
"abyss battle info layout")
p.write_text(s)

# ------------------------------------------------------------------
# 11) Loader version.
# ------------------------------------------------------------------
p=Path("js/20-anonymous-20.js")
s=p.read_text()
s=once(s,f'const V_ASSET_VERSION="{OLD}";',f'const V_ASSET_VERSION="{NEW}";',"asset version")
p.write_text(s)

# ------------------------------------------------------------------
# 12) Existing tests: update only contracts intentionally changed here.
# ------------------------------------------------------------------
# Current-release assertions.
for test_path in sorted(Path("tests").glob("*.js")):
    text=test_path.read_text()
    text=text.replace(f'const V_ASSET_VERSION="{OLD}\\"',f'const V_ASSET_VERSION="{NEW}\\"')
    text=text.replace(f'const V_ASSET_VERSION="{OLD}"',f'const V_ASSET_VERSION="{NEW}"')
    text=text.replace(f'<title>四象江湖傳 V{OLD}<\\/title>',f'<title>四象江湖傳 V{NEW}<\\/title>')
    text=text.replace(f'<title>四象江湖傳 V{OLD}</title>',f'<title>四象江湖傳 V{NEW}</title>')
    text=text.replace(f'aria-label="目前版本 V{OLD}"',f'aria-label="目前版本 V{NEW}"')
    text=text.replace(f'aria-label="目前版本 V{OLD.replace(".","\\.")}"',f'aria-label="目前版本 V{NEW.replace(".","\\.")}"')
    text=text.replace(f'v{OLD}-home-version-badge-style',f'v{NEW}-home-version-badge-style')
    text=text.replace(f'v{OLD.replace(".","\\.")}-home-version-badge-style',f'v{NEW.replace(".","\\.")}-home-version-badge-style')
    text=text.replace(f'>V{OLD}</div>',f'>V{NEW}</div>')
    text=text.replace(f'>V{OLD.replace(".","\\.")}<\\/div>',f'>V{NEW.replace(".","\\.")}<\\/div>')
    for entry in RELEASE_ENTRIES:
        text=text.replace(f'{entry}?v={OLD}',f'{entry}?v={NEW}')
        escaped=entry.replace('/','\\/').replace('.','\\.')
        text=text.replace(f'{escaped}\\?v={OLD.replace(".","\\.")}',f'{escaped}\\?v={NEW.replace(".","\\.")}')
    test_path.write_text(text)

# EXP dungeon expected ratio and representative 55k average reward.
for name in ["tests/v138-feature-requirements.test.js","tests/v138-browser-smoke.js","tests/v139-economy-rested-exp.test.js"]:
    p=Path(name); t=p.read_text()
    t=t.replace("EXP_DUNGEON_REWARD_RATIO=0.11","EXP_DUNGEON_REWARD_RATIO=0.33")
    t=t.replace("EXP_DUNGEON_REWARD_RATIO=0\\.11","EXP_DUNGEON_REWARD_RATIO=0\\.33")
    t=t.replace("6050","18150")
    t=t.replace("11% of the party's current average level requirement","33% of the party's current average level requirement")
    p.write_text(t)

# Home layout legacy assertions now expect 8 side-rail buttons / four rows.
for name in ["tests/v173.28-main-city-lobby.test.js","tests/v173.39-main-city-final-polish.test.js"]:
    p=Path(name); t=p.read_text()
    t=t.replace("repeat\\(3,82px\\)","repeat\\(4,82px\\)")
    t=t.replace("repeat(3,82px)","repeat(4,82px)")
    t=t.replace("min-height:256px","min-height:343px")
    p.write_text(t)

p=Path("tests/v173.28-main-city-lobby.test.js")
t=p.read_text()
t=rx_once(t,
    r'test\("offline experience and system use complete framed horizontal buttons",\(\)=>\{[\s\S]*?\n\}\);',
    '''test("offline experience and system join the existing side rails",()=>{\n    assert.equal(count(actions,/openHomeFeature\\('(offlineExp|system)'\\)/g),2);\n    assert.doesNotMatch(actions,/home-utility-actions/);\n    assert.match(actions,/homeIconAchievement[\\s\\S]*homeIconAnnouncement[\\s\\S]*homeIconOfflineExp[\\s\\S]*homeIconSystem/);\n});''',
    "home utility regression block")
p.write_text(t)

# Replace V169 tests with the new shared/locked contract.
Path("tests/v169-element-box-settings.test.js").write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const css=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(source,/先停止元素匣，才能設定/);
assert.match(source,/writeSharedRecoveryFromForm/);
assert.match(source,/config\.hp=hpValue/);
assert.match(source,/config\.sp=spValue/);
assert.match(source,/config\.returnToCityWhenEmpty=returnValue/);
assert.match(source,/field\.disabled=active/);
assert.match(source,/primary\.disabled=active/);
assert.match(index,/v17342-element-box-shared/);
assert.match(index,/共用設定/);
assert.match(index,/三名角色共用/);
assert.match(css,/v17342-element-box-lock-notice/);
assert.match(css,/v17342-settings-locked/);
console.log("v169 / V173.42 shared Element Box settings checks passed");
''')

# New focused regression for this request batch.
Path("tests/v173.42-player-flow.test.js").write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const v141=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const settings=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const abyssCss=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const core=fs.readFileSync("js/00-main.js","utf8");
assert.match(v141,/v17342UseInventoryPotion/);
assert.match(v141,/getBackpackCharacter\(inventoryCharacterIndex\)/);
assert.match(settings,/先停止元素匣，才能設定/);
assert.match(index,/v17342-element-box-shared/);
assert.match(recovery,/setInterval\(\(\)=>\{[\s\S]*isElementBoxRecoveryActive/);
assert.match(recovery,/v17342PendingBattleNotices/);
assert.match(core,/pendingElementBoxNotices/);
assert.match(abyss,/v17342-abyss-battle-info/);
assert.match(abyssCss,/aspect-ratio:9\/16/);
assert.match(v141,/hasExpLevelUp/);
assert.doesNotMatch(index,/home-utility-actions/);
assert.match(baseCss,/grid-template-rows:repeat\(4,82px\)/);
assert.match(v131,/V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3/);
assert.match(v131,/V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5/);
assert.match(v131,/getBeginnerForestMonsterExpUnit/);
assert.match(v131,/beginnerMonsterUnits/);
console.log("✓ V173.42 player flow / economy / Element Box regression passed");
''')

# Handoff.
p=Path("HANDOFF.md")
s=p.read_text()
entry='''\n## V173.42 玩家流程／元素匣／深淵資訊／收益調整\n- 背包補品詳情新增「使用」，作用對象固定為背包當前切換角色。\n- 元素匣啟動中鎖定所有設定並提示「先停止元素匣，才能設定」；HP/SP補品門檻與補品耗盡回主城改為三名角色共用區塊，自動行動仍各角色獨立。\n- 元素匣啟動後即使未進戰鬥，也每秒檢查一次補品門檻；補品使用資訊會進戰鬥資訊，非戰鬥期間產生的訊息會帶入下一場戰鬥資訊一次。\n- 深淵地圖底部新增戰鬥資訊區；封面維持 supplied 864×1536（9:16）比例，進入按鈕移到封面圖之外。\n- 經驗池足以讓任一未滿級角色升級時，角色入口與 HUD 經驗池亮紅點。\n- 離線經驗移至成就下方、系統移至公告下方，改用與其他六個側邊功能一致的 80×82 黑金卡。\n- 一般戰鬥現有 EXP ×3；怪物金幣掉落 ×5；經驗副本 11%→33%；離線 EXP ×3；任務/委託/成就/完成度獎勵 EXP×3、金幣×5；深淵最終寶箱 EXP×3、金幣×5。\n- 新手森林取消「1隻/3隻同一份固定EXP」，改依實際擊敗怪物數與rank權重計算，再套本輪全域EXP×3。\n- 僅修改 dev，未修改 main。\n'''
p.write_text(entry+s)

print("V173.42 changes staged")
