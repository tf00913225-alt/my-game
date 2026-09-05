from pathlib import Path


def replace_once(path, old, new, label):
    p=Path(path)
    text=p.read_text(encoding="utf-8")
    if old in text:
        p.write_text(text.replace(old,new,1),encoding="utf-8")
        return
    if new in text:
        return
    raise SystemExit(label+" anchor not found")

# Fire Rocket was being discarded on a cold cache before its Image preload finished.
p=Path("js/39-v143-skill-animation.js")
text=p.read_text(encoding="utf-8")
old='''            if(config.id==="fireRocket"&&model.sprite&&typeof Image==="function"){
                const record=getSpriteImage(model.sprite.src);
                if(!record||record.failed||!record.ready){ model.sprite=null; }
            }
'''
if old in text:
    text=text.replace(old,"",1)
elif 'config.id==="fireRocket"' in text and 'model.sprite=null' in text:
    raise SystemExit("fireRocket preload guard changed unexpectedly")
p.write_text(text,encoding="utf-8")

# Chain the V173.51 QA layers after V173.50 inventory QoL.
p=Path("js/53-v173.50-inventory-qol.js")
text=p.read_text(encoding="utf-8")
if "function loadV17351Qa()" not in text:
    marker="\n})();"
    pos=text.rfind(marker)
    if pos<0:
        raise SystemExit("V173.50 runtime tail not found")
    loader='''

    function loadV17351Qa(){
        if(typeof document==="undefined"||!document.head){ return; }
        if(!document.getElementById("v17351-qa-style")){
            const link=document.createElement("link");
            link.id="v17351-qa-style";
            link.rel="stylesheet";
            link.href="css/53-v173.51-qa.css?v=173.51";
            document.head.appendChild(link);
        }
        const queue=[
            ["v17351-battle-qa","js/54-v173.51-battle-qa.js?v=173.51"],
            ["v17351-inventory-qa","js/55-v173.51-inventory-qa.js?v=173.51"],
            ["v17351-shop-qa","js/56-v173.51-shop-qa.js?v=173.51"],
            ["v17351-quest-qa","js/57-v173.51-quest-qa.js?v=173.51"]
        ];
        let index=0;
        const next=function(){
            if(index>=queue.length){ return; }
            const pair=queue[index++];
            if(document.getElementById(pair[0])){ next(); return; }
            const script=document.createElement("script");
            script.id=pair[0];
            script.src=pair[1];
            script.async=false;
            script.onload=next;
            script.onerror=function(){
                if(typeof window.__v17347RuntimeGateFail==="function"){
                    window.__v17347RuntimeGateFail("V173.51 功能載入失敗，請重新整理。");
                }
            };
            document.head.appendChild(script);
        };
        next();
    }
    loadV17351Qa();
'''
    text=text[:pos]+loader+text[pos:]
p.write_text(text,encoding="utf-8")

# The startup gate now waits for the final V173.51 module before opening the game.
p=Path("js/equipment-progression.js")
text=p.read_text(encoding="utf-8")
text=text.replace('js/53-v173.50-inventory-qol.js?v=173.50','js/53-v173.50-inventory-qol.js?v=173.51')
old='script.onload=releaseV17350RuntimeGate;'
new='''script.onload=function(){
        const startedAt=Date.now();
        (function waitForV17351(){
            if(window.__v17351QaReady){ releaseV17350RuntimeGate(); return; }
            if(Date.now()-startedAt>5000){ failV17350RuntimeGate("V173.51 功能載入逾時，請重新整理。"); return; }
            setTimeout(waitForV17351,25);
        })();
    };'''
if old in text:
    text=text.replace(old,new,1)
elif "__v17351QaReady" not in text:
    raise SystemExit("equipment loader onload anchor not found")
p.write_text(text,encoding="utf-8")

replace_once("js/20-anonymous-20.js",'const V_ASSET_VERSION="173.50";','const V_ASSET_VERSION="173.51";',"asset version")
replace_once("js/51-v169-rpg-ui.js",'js/equipment-progression.js?v=173.50','js/equipment-progression.js?v=173.51',"equipment progression cache version")

# Current dev entry assets and visible badge all move to V173.51.
p=Path("index.html")
text=p.read_text(encoding="utf-8")
if "173.50" in text:
    text=text.replace("173.50","173.51")
elif "173.51" not in text:
    raise SystemExit("index current version anchor missing")
p.write_text(text,encoding="utf-8")

# V173.50 remains the base feature test; only current-loader expectations advance.
p=Path("tests/v173.50-inventory-qol.test.js")
text=p.read_text(encoding="utf-8")
text=text.replace(r'js\/53-v173\.50-inventory-qol\.js\?v=173\.50',r'js\/53-v173\.50-inventory-qol\.js\?v=173\.51')
text=text.replace(r'assert.match(equipment,/script\.onload=releaseV17350RuntimeGate/);',r'assert.match(equipment,/script\.onload=function\(\)\{[\s\S]*?__v17351QaReady/);')
text=text.replace('const V_ASSET_VERSION="173.50";','const V_ASSET_VERSION="173.51";')
text=text.replace('js/equipment-progression.js?v=173.50','js/equipment-progression.js?v=173.51')
text=text.replace('<title>四象江湖傳 V173.50</title>','<title>四象江湖傳 V173.51</title>')
p.write_text(text,encoding="utf-8")

print("V173.51 QA patch applied")
