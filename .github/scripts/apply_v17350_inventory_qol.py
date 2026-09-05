from pathlib import Path


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"{label} anchor not found")


# 1) Persistent no-potion return-to-city dialog.
path = Path("js/45-v154-dev-fixes.js")
text = path.read_text(encoding="utf-8")
old = '''        if(shouldReturnToCity&&elementBoxActive){
            logElementBoxRecovery("元素匣偵測到補品不足，已停止巡練並返回主城。");
            if(typeof window.v169StopElementBox==="function"){ window.v169StopElementBox(); }
            else if(typeof toggleAutoBattle==="function"&&typeof autoBattle!=="undefined"&&autoBattle){ toggleAutoBattle(); }
            if(typeof showPage==="function"){ showPage("home"); }
        }
'''
new = '''        if(shouldReturnToCity&&elementBoxActive){
            const emptyPotionMessage="元素匣偵測到補品不足，已停止巡練並返回主城。";
            logElementBoxRecovery(emptyPotionMessage);
            if(typeof window.v169StopElementBox==="function"){ window.v169StopElementBox(); }
            else if(typeof toggleAutoBattle==="function"&&typeof autoBattle!=="undefined"&&autoBattle){ toggleAutoBattle(); }
            if(typeof showPage==="function"){ showPage("home"); }
            if(typeof window.rpgAlert==="function"){
                void window.rpgAlert(
                    "自動補品已用完，元素匣已停止巡練並返回主城。\\n請補充補品後，再重新啟動元素匣。",
                    {title:"補品不足",confirmText:"知道了",danger:true}
                );
            }else if(typeof alert==="function"){
                alert(emptyPotionMessage);
            }
        }
'''
text = replace_once(text, old, new, "empty potion return dialog")
path.write_text(text, encoding="utf-8")


# 2) Keep the startup/runtime gate closed until the V173.50 QoL runtime is installed.
path = Path("js/equipment-progression.js")
text = path.read_text(encoding="utf-8")
old = '''    if(typeof window.__v17347RuntimeGateRelease==="function"){
        window.__v17347RuntimeGateRelease();
    }
})();
'''
new = '''    function releaseV17350RuntimeGate(){
        if(typeof window.__v17347RuntimeGateRelease==="function"){
            window.__v17347RuntimeGateRelease();
        }
    }
    function failV17350RuntimeGate(message){
        if(typeof window.__v17347RuntimeGateFail==="function"){
            window.__v17347RuntimeGateFail(message||"背包與批量操作系統載入失敗，請重新整理。");
        }
    }
    function loadV17350InventoryQol(){
        if(typeof document==="undefined"||!document.head){
            releaseV17350RuntimeGate();
            return;
        }
        if(!document.getElementById("v17350-inventory-qol-style")){
            const link=document.createElement("link");
            link.id="v17350-inventory-qol-style";
            link.rel="stylesheet";
            link.href="css/52-v173.50-inventory-qol.css?v=173.50";
            link.onerror=function(){ failV17350RuntimeGate("背包介面樣式載入失敗，請重新整理。"); };
            document.head.appendChild(link);
        }
        if(document.getElementById("v17350-inventory-qol-runtime")){
            releaseV17350RuntimeGate();
            return;
        }
        const script=document.createElement("script");
        script.id="v17350-inventory-qol-runtime";
        script.src="js/53-v173.50-inventory-qol.js?v=173.50";
        script.async=false;
        script.onload=releaseV17350RuntimeGate;
        script.onerror=function(){ failV17350RuntimeGate("背包與批量操作系統載入失敗，請重新整理。"); };
        document.head.appendChild(script);
    }
    loadV17350InventoryQol();
})();
'''
text = replace_once(text, old, new, "V173.50 critical runtime loader")
path.write_text(text, encoding="utf-8")


# 3) Cache-bust all late-loaded runtime files.
path = Path("js/20-anonymous-20.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'const V_ASSET_VERSION="173.49";',
    'const V_ASSET_VERSION="173.50";',
    "asset version",
)
path.write_text(text, encoding="utf-8")

path = Path("js/51-v169-rpg-ui.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'js/equipment-progression.js?v=173.49',
    'js/equipment-progression.js?v=173.50',
    "equipment progression cache version",
)
path.write_text(text, encoding="utf-8")

# 4) Visible release/cache references in the entry document.
path = Path("index.html")
text = path.read_text(encoding="utf-8")
if "173.49" in text:
    text = text.replace("173.49", "173.50")
elif "173.50" not in text:
    raise SystemExit("index version anchor not found")
path.write_text(text, encoding="utf-8")

# 5) Current-version test expectations. Historical feature-marker assertions are restored below.
for p in Path("tests").glob("*.js"):
    source = p.read_text(encoding="utf-8")
    updated = source.replace(r"173\.49", r"173\.50").replace("173.49", "173.50")
    if p.name == "v173.49-exp-pool-scroll-stability.test.js":
        updated = updated.replace(
            r"V173\.50 — EXP POOL TAP \/ SCROLL STABILITY",
            r"V173\.49 — EXP POOL TAP \/ SCROLL STABILITY",
        )
    if updated != source:
        p.write_text(updated, encoding="utf-8")

# 6) Focused regression coverage for this request.
Path("tests/v173.50-inventory-qol.test.js").write_text(r'''"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const css=fs.readFileSync("css/52-v173.50-inventory-qol.css","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(css,/\.v17342-element-box-use-notice\{[\s\S]*?font-size:27px !important/);
assert.match(qol,/window\.v17350BulkSellEquipment=async function/);
assert.match(qol,/QUALITY_ORDER=\["white","blue","purple","orange"\]/);
assert.match(qol,/summary\.hasOrangeOrAbove[\s\S]*?window\.rpgConfirm/);
assert.match(qol,/橙裝售出後無法復原/);
assert.match(qol,/id="v17350BulkSellQuality"/);
assert.match(qol,/window\.v17350RunBatchAction=async function/);
assert.match(qol,/id="v17350BatchQuantity"[\s\S]*?value="'\+descriptor\.total\+'"/);
assert.match(qol,/descriptor\.kind==="potion"/);
assert.match(qol,/descriptor\.kind==="chest"/);
assert.match(qol,/descriptor\.kind==="ticket"/);
assert.match(recovery,/window\.rpgAlert\([\s\S]*?title:"補品不足"[\s\S]*?confirmText:"知道了"/);
assert.doesNotMatch(recovery,/補品不足[\s\S]{0,180}setTimeout\(/);
assert.match(equipment,/css\/52-v173\.50-inventory-qol\.css\?v=173\.50/);
assert.match(equipment,/js\/53-v173\.50-inventory-qol\.js\?v=173\.50/);
assert.match(equipment,/script\.onload=releaseV17350RuntimeGate/);
assert.ok(loader.includes('const V_ASSET_VERSION="173.50";'));
assert.ok(ui.includes('js/equipment-progression.js?v=173.50'));
assert.ok(index.includes('<title>四象江湖傳 V173.50</title>'));

console.log("✓ V173.50 inventory QoL and persistent no-potion warning");
''', encoding="utf-8")

print("V173.50 patch applied")
