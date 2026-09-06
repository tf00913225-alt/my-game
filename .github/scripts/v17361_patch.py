from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")

def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    write(path, text.replace(old, new, 1))

def regex_once(path, pattern, replacement, label, flags=re.S):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected one regex anchor, found {count}")
    write(path, updated)

def append_once(path, marker, block):
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + "\n\n" + block.strip() + "\n")

# 1. V173.61 release/cache wiring.
write("index.html", read("index.html").replace("173.60", "173.61"))
for path in [
    "js/20-anonymous-20.js",
    "js/51-v169-rpg-ui.js",
    "js/53-v173.50-inventory-qol.js",
    "js/equipment-progression.js",
]:
    write(path, read(path).replace("173.60", "173.61"))

for path in [
    "tests/v138-feature-requirements.test.js",
    "tests/v173.20-startup-loader.test.js",
    "tests/v173.47-runtime-integrity.test.js",
    "tests/v173.48-premium-shop-layout.test.js",
    "tests/v173.49-exp-pool-scroll-stability.test.js",
    "tests/v173.50-inventory-qol.test.js",
    "tests/v173.51-qa.test.js",
    "tests/v173.53-startup-stall-regression.test.js",
    "tests/v173.54-qa-readiness.test.js",
    "tests/v173.55-inventory-observer-stall.test.js",
    "tests/v173.60-formal-tiers-talismans.test.js",
]:
    write(path, read(path).replace("173.60", "173.61"))

# 2. Patrol power-saving control.
html = read("index.html")
quick_hint = '              <div class="map-quick-toggle-hint">'
if html.count(quick_hint) != 1:
    raise SystemExit(f"patrol hint marker count={html.count(quick_hint)}")
power_button = '''              <button
                  id="quickPowerSavingToggle"
                  class="map-quick-toggle-btn v17361-power-save-toggle"
                  type="button"
                  onclick="v17361TogglePowerSaving()"
                  aria-label="省電模式"
                  aria-pressed="false"
              >省電 OFF</button>

'''
html = html.replace(quick_hint, power_button + quick_hint, 1)
write("index.html", html)

# 3. Supplied ore + common general-dungeon chest art.
replace_once(
    "js/27-v132-content-expansion.js",
    'icon:oreIcon(tier.key),',
    'icon:rasterItemIcon("assets/items/materials/ore.png",tier.key,"material"),',
    "ore art",
)
regex_once(
    "js/27-v132-content-expansion.js",
    r'    function chestIcon\(\)\{[\s\S]*?\n    \}\n\n    function ticketIcon',
    '''    function chestIcon(){
        return rasterItemIcon("assets/items/chests/dungeon-chest.png","blue","chest");
    }
    // All general-dungeon backpack chests share this visual; item name stays semantic.
    window.v17361GeneralDungeonChestIcon=chestIcon;

    function ticketIcon''',
    "shared chest helper",
)

# Keep old saved ore/chest stacks visually synchronized after definitions are available.
content = read("js/27-v132-content-expansion.js")
material_chest_anchor = '''    const materialChestDefinition={
        id:"materialChest",
        name:"材料寶箱",
        icon:chestIcon(),
        type:"chest",
        price:0,
        stats:{}
    };'''
if content.count(material_chest_anchor) != 1:
    raise SystemExit(f"material chest definition count={content.count(material_chest_anchor)}")
sync_block = material_chest_anchor + '''

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
    syncV17361ItemArt();'''
content = content.replace(material_chest_anchor, sync_block, 1)
write("js/27-v132-content-expansion.js", content)

# 4. Remove the old CSS skill flashes only. Keep Canvas particles and current Sprite VFX.
regex_once(
    "js/35-v141-ui-battle.js",
    r'    window\.v141PlayCardEffect=function\(side,index,type\)\{[\s\S]*?\n    \};\n\n    function executeAdditionalSupportAction',
    '''    window.v141PlayCardEffect=function(side,index,type){
        const card=cardFor(side,index);
        if(!card){ return; }
        // V173.61: CSS skill flashes retired; non-CSS Canvas particles remain.
        playCanvasParticles(card,type);
    };

    function executeAdditionalSupportAction''',
    "v141 card CSS effect",
)
skill_css = read("css/38-v141-system-expansion.css")
skill_css, count = re.subn(
    r'\n#game-stage #battlePage \.v141-once-heal,[\s\S]*?#game-stage #battlePage \.v141-once-talisman\{\n    animation:v141TalismanFlash \.82s ease-out !important;\n\}\n',
    "\n",
    skill_css,
    count=1,
)
if count != 1:
    raise SystemExit(f"CSS one-shot skill class block count={count}")
for keyframe in ["v141HealFlash", "v141ReviveFlash", "v141TalismanFlash"]:
    skill_css, count = re.subn(r'@keyframes ' + keyframe + r'\{[^\n]*\}\n?', "", skill_css, count=1)
    if count != 1:
        raise SystemExit(f"CSS keyframe {keyframe} count={count}")
write("css/38-v141-system-expansion.css", skill_css)

# 5. Battle procedural SFX only: 0.22 -> 0.30.
replace_once("js/34-v141-core-systems.js", "master.gain.value=0.22;", "master.gain.value=0.30;", "battle gain")

# 6. Live quest state refresh when background progress actually changes.
regex_once(
    "js/34-v141-core-systems.js",
    r'    function recordQuestProgress\(id,amount,type\)\{[\s\S]*?\n    \}\n    window\.v141RecordQuestProgress=recordQuestProgress;',
    '''    function recordQuestProgress(id,amount,type){
        if(typeof ensureDailyQuestsCurrent!=="function"){ return; }
        ensureDailyQuestsCurrent();
        const state=type==="commission"?commissionQuestState:dailyQuestState;
        const definitions=type==="commission"?commissionQuestDefinitions:dailyQuestDefinitions;
        const quest=definitions.find(item=>item.id===id);
        if(!quest){ return; }
        const before=Number(state.progress[id])||0;
        const after=Math.min(quest.goal,before+Math.max(0,Number(amount)||0));
        if(after===before){ return; }
        state.progress[id]=after;
        if(typeof window.v17361RefreshOpenQuestPage==="function"){ window.v17361RefreshOpenQuestPage(); }
        if(typeof window.v148SyncQuestNoticeDots==="function"){ window.v148SyncQuestNoticeDots(); }
    }
    window.v141RecordQuestProgress=recordQuestProgress;''',
    "live quest progress",
)

# 7. Screen Wake Lock + patrol power-saving preference, inside existing core owner.
core_path = "js/34-v141-core-systems.js"
core = read(core_path)
if "V17361_POWER_SAVE_KEY" not in core:
    pos = core.rfind("\n})();")
    if pos < 0:
        raise SystemExit("js34 final IIFE anchor missing")
    wake = '''

    /* V173.61 — screen wake / patrol power-saving owner. */
    const V17361_POWER_SAVE_KEY="v17361_patrol_power_saving";
    let v17361ScreenWakeLock=null;

    function v17361PowerSavingEnabled(){
        try{ return localStorage.getItem(V17361_POWER_SAVE_KEY)==="1"; }catch(_){ return false; }
    }
    function v17361SyncPowerSavingButton(){
        if(typeof document==="undefined"){ return; }
        const button=document.getElementById("quickPowerSavingToggle");
        if(!button){ return; }
        const enabled=v17361PowerSavingEnabled();
        button.classList.toggle("active",enabled);
        button.setAttribute("aria-pressed",enabled?"true":"false");
        button.textContent=enabled?"省電 ON":"省電 OFF";
        button.title=enabled?"允許螢幕依系統設定休眠":"遊戲會嘗試保持螢幕常亮";
    }
    async function v17361ReleaseWakeLock(){
        const lock=v17361ScreenWakeLock;
        v17361ScreenWakeLock=null;
        if(lock&&typeof lock.release==="function"){ try{ await lock.release(); }catch(_){ } }
    }
    async function v17361RequestWakeLock(){
        v17361SyncPowerSavingButton();
        if(v17361PowerSavingEnabled()||typeof document==="undefined"||document.visibilityState!=="visible"){
            await v17361ReleaseWakeLock();
            return false;
        }
        if(typeof navigator==="undefined"||!navigator.wakeLock||typeof navigator.wakeLock.request!=="function"){ return false; }
        if(v17361ScreenWakeLock&&!v17361ScreenWakeLock.released){ return true; }
        try{
            const lock=await navigator.wakeLock.request("screen");
            v17361ScreenWakeLock=lock;
            if(lock&&typeof lock.addEventListener==="function"){
                lock.addEventListener("release",()=>{ if(v17361ScreenWakeLock===lock){ v17361ScreenWakeLock=null; } });
            }
            return true;
        }catch(_){ v17361ScreenWakeLock=null; return false; }
    }
    window.v17361TogglePowerSaving=function(){
        const next=!v17361PowerSavingEnabled();
        try{ localStorage.setItem(V17361_POWER_SAVE_KEY,next?"1":"0"); }catch(_){ }
        v17361SyncPowerSavingButton();
        if(next){ void v17361ReleaseWakeLock(); }
        else{ void v17361RequestWakeLock(); }
        return next;
    };
    window.v17361RequestWakeLock=v17361RequestWakeLock;
    window.v17361ReleaseWakeLock=v17361ReleaseWakeLock;
    if(typeof document!=="undefined"){
        document.addEventListener("pointerdown",()=>{ void v17361RequestWakeLock(); },{once:true,passive:true});
        document.addEventListener("visibilitychange",()=>{
            if(document.visibilityState==="visible"){ void v17361RequestWakeLock(); }
            else{ void v17361ReleaseWakeLock(); }
        });
        setTimeout(v17361SyncPowerSavingButton,0);
    }
'''
    core = core[:pos] + wake + core[pos:]
    write(core_path, core)

# 8. Quest owner: daily/commission claim-all + targeted open-page redraw.
quest_path = "js/00-main.js"
quest = read(quest_path)
marker = "\n\n\n/*\n   V89：任務視窗為「固定標籤列 + 內層任務清單 + 固定完成度獎勵」架構。"
if quest.count(marker) != 1:
    raise SystemExit(f"quest helper marker count={quest.count(marker)}")
helpers = '''

function getClaimableQuestIds(definitions,state){
    return (definitions||[]).filter(function(quest){
        return quest && !state.claimed[quest.id] &&
            (Number(state.progress[quest.id])||0)>=Math.max(1,Number(quest.goal)||1);
    }).map(function(quest){ return quest.id; });
}

function v17361SyncQuestClaimAllButton(isCommission){
    const button=$("questClaimAllButton");
    if(!button){ return; }
    const definitions=isCommission?commissionQuestDefinitions:dailyQuestDefinitions;
    const state=isCommission?commissionQuestState:dailyQuestState;
    const count=getClaimableQuestIds(definitions,state).length;
    button.disabled=count<=0;
    button.textContent=count>0?"一鍵領取（"+count+"）":"一鍵領取";
    button.onclick=isCommission?v17361ClaimAllCommissionQuests:v17361ClaimAllDailyQuests;
}

function v17361RefreshOpenQuestPage(){
    const body=$("questTabBody");
    if(!body){ return false; }
    const commissionBtn=$("questTabBtnCommission");
    const isCommission=!!(commissionBtn&&commissionBtn.classList.contains("active"));
    const scrollTop=body.scrollTop;
    body.innerHTML=isCommission?renderCommissionQuestListContent():renderDailyQuestListContent();
    const completionPanel=$("questCompletionPanel");
    if(completionPanel){
        completionPanel.innerHTML=renderQuestCompletionPanelContent(
            isCommission?commissionQuestDefinitions:dailyQuestDefinitions,
            isCommission?commissionQuestState:dailyQuestState
        );
    }
    body.scrollTop=scrollTop;
    v17361SyncQuestClaimAllButton(isCommission);
    return true;
}
window.v17361RefreshOpenQuestPage=v17361RefreshOpenQuestPage;
'''
quest = quest.replace(marker, helpers + marker, 1)

body_marker = '<div id="questTabBody" class="quest-tab-body" role="tabpanel">'
if quest.count(body_marker) != 1:
    raise SystemExit(f"quest body marker count={quest.count(body_marker)}")
batch_html = '''<div class="quest-batch-actions">'+
                '<button id="questClaimAllButton" class="quest-claim-all-btn" type="button" '+
                    (getClaimableQuestIds(
                        isCommission?commissionQuestDefinitions:dailyQuestDefinitions,
                        isCommission?commissionQuestState:dailyQuestState
                    ).length?'':'disabled ')+
                    'onclick="'+(isCommission?'v17361ClaimAllCommissionQuests()':'v17361ClaimAllDailyQuests()')+'">一鍵領取</button>'+
            '</div>'+

            '<div id="questTabBody" class="quest-tab-body" role="tabpanel">'''
quest = quest.replace(body_marker, batch_html, 1)

# Synchronize button after a tab switch without reopening the modal.
start = quest.index("function switchQuestTab(tabName){")
end = quest.index("\n\n\n/*\n   ★ 新增（依照使用者要求，新增副本/BOSS", start)
segment = quest[start:end]
close = segment.rfind("\n}")
if close < 0:
    raise SystemExit("switchQuestTab close missing")
segment = segment[:close] + "\n    v17361SyncQuestClaimAllButton(isCommission);\n" + segment[close:]
quest = quest[:start] + segment + quest[end:]

# Suppress individual redraws during a bulk claim, scoped to each claim function.
daily_start = quest.index("function claimDailyQuest(questId){")
commission_start = quest.index("function claimCommissionQuest(questId){")
daily_seg = quest[daily_start:commission_start]
daily_seg, count = re.subn(r'\n\s*switchQuestTab\(\s*"daily"\s*\);', '\n    if(!window.__v17361BulkQuestClaim){ switchQuestTab("daily"); }', daily_seg, count=1)
if count != 1:
    raise SystemExit(f"daily claim redraw count={count}")
quest = quest[:daily_start] + daily_seg + quest[commission_start:]
commission_start = quest.index("function claimCommissionQuest(questId){")
commission_end = quest.index("/* =====================================================\n   ★ 圖鑑", commission_start)
commission_seg = quest[commission_start:commission_end]
commission_seg, count = re.subn(r'\n\s*switchQuestTab\(\s*"commission"\s*\);', '\n    if(!window.__v17361BulkQuestClaim){ switchQuestTab("commission"); }', commission_seg, count=1)
if count != 1:
    raise SystemExit(f"commission claim redraw count={count}")
quest = quest[:commission_start] + commission_seg + quest[commission_end:]

bestiary = "/* =====================================================\n   ★ 圖鑑\n===================================================== */"
if quest.count(bestiary) != 1:
    raise SystemExit(f"bestiary marker count={quest.count(bestiary)}")
bulk = '''function v17361ClaimAllQuestGroup(definitions,state,claimFn,title){
    const ids=getClaimableQuestIds(definitions,state);
    if(!ids.length){ v17361RefreshOpenQuestPage(); return 0; }
    window.__v17361BulkQuestClaim=true;
    try{ ids.forEach(function(id){ claimFn(id); }); }
    finally{ window.__v17361BulkQuestClaim=false; }
    v17361RefreshOpenQuestPage();
    if(typeof window.rpgAlert==="function"){
        void window.rpgAlert("已一鍵領取 "+ids.length+" 個"+title+"獎勵。",{title:title+"獎勵",confirmText:"知道了",tone:"success"});
    }
    return ids.length;
}
function v17361ClaimAllDailyQuests(){
    return v17361ClaimAllQuestGroup(dailyQuestDefinitions,dailyQuestState,claimDailyQuest,"每日任務");
}
function v17361ClaimAllCommissionQuests(){
    return v17361ClaimAllQuestGroup(commissionQuestDefinitions,commissionQuestState,claimCommissionQuest,"委託任務");
}
window.v17361ClaimAllDailyQuests=v17361ClaimAllDailyQuests;
window.v17361ClaimAllCommissionQuests=v17361ClaimAllCommissionQuests;

'''
quest = quest.replace(bestiary, bulk + bestiary, 1)
write(quest_path, quest)

# Existing V173.51 per-item reward notices are suppressed only during claim-all.
qa_path = "js/57-v173.51-quest-qa.js"
qa = read(qa_path)
count = qa.count("if(!b&&a&&q)")
if count != 2:
    raise SystemExit(f"quest QA popup anchors count={count}")
write(qa_path, qa.replace("if(!b&&a&&q)", "if(!window.__v17361BulkQuestClaim&&!b&&a&&q)"))

# 9. Image-first general-dungeon reward previews.
regex_once(
    "js/42-v148-combat-dungeon-fixes.js",
    r'    window\.v148ShowDailyDungeonPreview=function\(type\)\{[\s\S]*?\n    \};\n\n    if\(typeof renderDungeonTabContent',
    '''    function v17361DailyRewardVisual(type){
        if(type==="material"){
            return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon material" aria-label="材料寶箱與礦石">'+
                '<img class="v17361-chest-art" src="assets/items/chests/dungeon-chest.png" alt="材料寶箱">'+
                '<img class="v17361-ore-mini" src="assets/items/materials/ore.png" alt="礦石">'+
                '<em>1–3</em></div></div>';
        }
        if(type==="gold"){
            return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon cover" aria-label="金幣獎勵">'+
                '<img src="assets/dungeons/covers/gold-v17344.png" alt="金幣"></div></div>';
        }
        return '<div class="v17361-reward-visual single"><div class="v17361-reward-icon" aria-label="經驗獎勵">'+
            '<img src="assets/ui/home-offline-exp.png" alt="經驗"></div></div>';
    }
    window.v148ShowDailyDungeonPreview=function(type){
        const meta=DAILY_DUNGEON_META[type];
        if(!meta||typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner v17361-reward-preview"><h3>'+meta.title+'獎勵預覽</h3>'+v17361DailyRewardVisual(type)+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };

    if(typeof renderDungeonTabContent''',
    "daily reward preview",
)

# Equipment dungeon joins the same visual language using real equipment art.
regex_once(
    "js/equipment-progression.js",
    r'    window\.v17346ShowEquipmentDungeonPreview=function\(\)\{[\s\S]*?\n    \};\n\n    if\(typeof renderDungeonTabContent',
    '''    window.v17346ShowEquipmentDungeonPreview=function(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const rewards=[
            ["white","assets/equipment/warrior/head-01.png","40%"],
            ["blue","assets/equipment/warrior/armor-01.png","40%"],
            ["purple","assets/equipment/warrior/shoes-01.png","15%"],
            ["orange","assets/equipment/warrior/weapon-01.png","5%"]
        ];
        const tiles=rewards.map(entry=>'<div class="v17361-reward-icon rarity-'+entry[0]+'"><img src="'+entry[1]+'" alt=""><em>'+entry[2]+'</em></div>').join("");
        const html='<div class="v132-reward-modal-inner v17346-preview-modal v17361-reward-preview"><h3>裝備副本獎勵預覽</h3>'+ 
            '<div class="v17361-reward-visual equipment">'+tiles+'</div>'+ 
            '<div class="v17361-chest-count" aria-label="兩個裝備寶箱"><img src="assets/items/chests/dungeon-chest.png" alt=""><b>×2</b></div>'+ 
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };

    if(typeof renderDungeonTabContent''',
    "equipment reward preview",
)

# 10. UI styles: common return fill, power-save control, claim-all, premium reward visuals.
append_once(
    "css/00-main.css",
    "V173.61 — shared return icon center fill",
    '''/* V173.61 — shared return icon center fill / patrol power saving / quest batch action */
#game-stage img[src*="map-return.png"]{background:#050505;border-radius:50%;}
#game-stage .map-quick-toggle-btn.v17361-power-save-toggle{
    width:auto !important;min-width:64px;padding:0 9px !important;
    border:1px solid rgba(205,160,82,.74) !important;border-radius:12px !important;
    background:rgba(7,7,7,.9) !important;color:#d8c79f !important;
    font-size:10px !important;font-weight:900 !important;letter-spacing:.04em;white-space:nowrap;
}
#game-stage .map-quick-toggle-btn.v17361-power-save-toggle.active{
    border-color:#7ee0a9 !important;color:#aef1c9 !important;
    box-shadow:inset 0 0 0 1px rgba(126,224,169,.2),0 0 9px rgba(80,194,128,.2) !important;
}
#game-stage .quest-batch-actions{display:flex;justify-content:flex-end;padding:8px 10px 4px;}
#game-stage .quest-claim-all-btn{
    min-width:108px;min-height:36px;padding:7px 12px;border:1px solid #b98a42;border-radius:8px;
    background:linear-gradient(180deg,#4c3316,#211308);color:#ffe0a0;font-size:12px;font-weight:900;
}
#game-stage .quest-claim-all-btn:disabled{opacity:.42;filter:grayscale(.35);}''',
)
append_once(
    "css/43-v148-combat-dungeon-fixes.css",
    "V173.61 — image-first daily reward previews",
    '''/* V173.61 — image-first daily reward previews */
#game-stage .v17361-reward-preview{max-width:420px;}
#game-stage .v17361-reward-visual{display:grid;gap:10px;margin:10px auto 14px;}
#game-stage .v17361-reward-visual.single{grid-template-columns:minmax(0,170px);justify-content:center;}
#game-stage .v17361-reward-visual.equipment{grid-template-columns:repeat(2,minmax(0,1fr));}
#game-stage .v17361-reward-icon{
    position:relative;aspect-ratio:1;overflow:hidden;border:1px solid rgba(209,167,92,.72);border-radius:14px;
    background:radial-gradient(circle at 50% 38%,rgba(104,79,38,.28),rgba(8,7,6,.96) 72%);
    box-shadow:inset 0 0 20px rgba(0,0,0,.62),0 7px 18px rgba(0,0,0,.28);
}
#game-stage .v17361-reward-icon>img:not(.v17361-ore-mini){width:100%;height:100%;display:block;object-fit:contain;padding:8px;box-sizing:border-box;}
#game-stage .v17361-reward-icon.cover>img{object-fit:cover!important;padding:0!important;}
#game-stage .v17361-reward-icon.material .v17361-chest-art{padding:4px!important;}
#game-stage .v17361-reward-icon .v17361-ore-mini{
    position:absolute;right:6px;bottom:6px;width:42%;height:42%;object-fit:contain;padding:3px;
    border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(5,5,5,.82);
}
#game-stage .v17361-reward-icon>em{
    position:absolute;right:7px;top:7px;min-width:34px;padding:3px 7px;border-radius:999px;background:rgba(5,5,5,.88);
    border:1px solid rgba(238,195,113,.55);color:#ffe2a5;font-style:normal;font-size:11px;font-weight:900;text-align:center;
}
#game-stage .v17361-reward-icon.rarity-white{border-color:#D8D8D8;}
#game-stage .v17361-reward-icon.rarity-blue{border-color:#42A5FF;box-shadow:inset 0 0 18px rgba(66,165,255,.16),0 0 10px rgba(66,165,255,.16);}
#game-stage .v17361-reward-icon.rarity-purple{border-color:#B05CFF;box-shadow:inset 0 0 18px rgba(176,92,255,.18),0 0 12px rgba(176,92,255,.18);}
#game-stage .v17361-reward-icon.rarity-orange{border-color:#FF9F38;box-shadow:inset 0 0 18px rgba(255,159,56,.2),0 0 14px rgba(255,159,56,.2);}
#game-stage .v17361-chest-count{display:flex;align-items:center;justify-content:center;gap:4px;margin:-4px 0 10px;color:#f8d58d;font-weight:900;}
#game-stage .v17361-chest-count img{width:42px;height:42px;object-fit:contain;}
#game-stage .v17361-chest-count b{font-size:14px;}''',
)

# 11. Handoff truth source.
handoff = read("HANDOFF.md")
if not handoff.lstrip().startswith("## V173.61"):
    entry = '''## V173.61 返回圖示／道具圖／副本預覽／音效／常亮省電／任務即時領取（目前 dev）
- V173.60 已通過受保護 Repository checks 並由 PR #70 正式合併 main；本輪新修改只在 dev。
- `css/00-main.css` 是共用返回按鈕視覺 owner：所有實際使用 `assets/ui/map-return.png` 的入口統一補 `#050505` 圓形黑底。
- 素材分支的「礦石.png」「副本與背包的寶箱.png」已導入 `assets/items/materials/ore.png`、`assets/items/chests/dungeon-chest.png`；既有背包礦石／材料寶箱也會同步新圖示。
- 一般副本獎勵預覽由 `js/42` + `css/43` 改為圖片優先；裝備副本由既有 `js/equipment-progression.js` 同步改成實際裝備圖＋正式階級框。
- 戰鬥程序音效 `js/34` master gain 0.22→0.30；`js/35` 移除 `v141-once-*` CSS flash，但保留 Canvas particles；`js/39` Sprite/VFX 時序仍是現行技能動畫 owner。
- 一般模式在首次使用者操作後嘗試 Screen Wake Lock；巡怪新增「省電 OFF/ON」，省電 ON 釋放 Wake Lock，頁面隱藏時也會釋放。
- 每日／委託正式加入一鍵領取；背景任務進度變化時只刷新已開啟的任務內容與完成度，保留目前分頁／捲動位置。成就既有一鍵領取保留。
- 版本與 live cache key 同步 V173.61。

'''
    write("HANDOFF.md", entry + handoff.lstrip())

# 12. Dedicated regression test.
test = '''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("index.html");
const mainCss=read("css/00-main.css");
const dailyCss=read("css/43-v148-combat-dungeon-fixes.css");
const oldSkillCss=read("css/38-v141-system-expansion.css");
const ui=read("js/35-v141-ui-battle.js");
const core=read("js/34-v141-core-systems.js");
const quest=read("js/00-main.js");
const questQa=read("js/57-v173.51-quest-qa.js");
const daily=read("js/42-v148-combat-dungeon-fixes.js");
const content=read("js/27-v132-content-expansion.js");
const equipment=read("js/equipment-progression.js");
const loader=read("js/20-anonymous-20.js");
assert.ok(fs.existsSync(path.join(root,"assets/items/materials/ore.png")));
assert.ok(fs.existsSync(path.join(root,"assets/items/chests/dungeon-chest.png")));
assert.match(content,/assets\/items\/materials\/ore\.png/);
assert.match(content,/assets\/items\/chests\/dungeon-chest\.png/);
assert.match(content,/syncV17361ItemArt/);
assert.match(mainCss,/img\[src\*="map-return\.png"\][\s\S]*background:#050505/);
assert.match(html,/id="quickPowerSavingToggle"/);
assert.match(core,/navigator\.wakeLock\.request\("screen"\)/);
assert.match(core,/V17361_POWER_SAVE_KEY/);
assert.match(core,/master\.gain\.value=0\.30/);
assert.doesNotMatch(ui,/v141-once-/);
assert.doesNotMatch(oldSkillCss,/v141HealFlash|v141ReviveFlash|v141TalismanFlash|v141-once-/);
assert.match(daily,/v17361DailyRewardVisual/);
assert.match(dailyCss,/v17361-reward-visual/);
assert.doesNotMatch(equipment,/⬜|🟦|🟪|🟧/);
assert.match(equipment,/rarity-white/);
assert.match(quest,/v17361ClaimAllDailyQuests/);
assert.match(quest,/v17361ClaimAllCommissionQuests/);
assert.match(quest,/v17361RefreshOpenQuestPage/);
assert.match(core,/v17361RefreshOpenQuestPage/);
assert.match(questQa,/__v17361BulkQuestClaim/);
assert.match(questQa,/v17351ClaimAllAchievements/);
assert.ok(loader.includes('const V_ASSET_VERSION="173.61";'));
assert.ok(html.includes('<title>四象江湖傳 V173.61</title>'));
console.log("✓ V173.61 current request integration");
'''
write("tests/v173.61-current-request.test.js", test)

print("V173.61 patch staged successfully")
