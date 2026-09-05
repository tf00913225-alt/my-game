from pathlib import Path
import re

path = Path("js/equipment-progression.js")
text = path.read_text(encoding="utf-8")

if "function loadV17350InventoryQol()" not in text:
    pattern = re.compile(
        r'\n\s*if\(typeof window\.__v17347RuntimeGateRelease==="function"\)\{\s*'
        r'window\.__v17347RuntimeGateRelease\(\);\s*\}\s*\}\)\(\);\s*$',
        re.S,
    )
    replacement = '''

    function releaseV17350RuntimeGate(){
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
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit("runtime gate suffix not found; tail=" + repr(text[-400:]))
    path.write_text(text, encoding="utf-8")

print("V173.50 runtime tail ready")
