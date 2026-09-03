from pathlib import Path

OLD="173.40"
NEW="173.41"
BASE_SHA="8b1e91ee3645fa3c50da13f269f5092a3c767013"
RELEASE_ENTRIES=[
    "css/00-main.css",
    "css/19-stage-v54-main-city-moderate-native-scale.css",
    "js/00-main.js",
    "js/16-stage-v54-main-city-runtime.js",
    "js/19-stage-v78-character-inventory-runtime.js",
    "js/20-anonymous-20.js",
]

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)

# 1) Core lifecycle owner: skip the long startup overlay after the current tab
# session has already entered once, and persist immediately before Android can
# suspend/kill the renderer.
p=Path("js/00-main.js")
s=p.read_text()
anchor='''const SAVE_KEY =\n    "battle_full_version_save_v5";\n\n'''
block='''const SAVE_KEY =\n    "battle_full_version_save_v5";\n\n\n/* =====================================================\n   V173.41 — MOBILE SESSION RESUME / BACKGROUND SAVE\n   - The 12~15 second startup sequence remains first-entry only.\n   - A reload inside the same browser tab session skips the long overlay.\n   - Android background/page suspension saves immediately before eviction.\n===================================================== */\nconst STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";\n\n(function installMobileSessionResume(){\n\n    if(window.v17341SessionResumeInstalled){ return; }\n    window.v17341SessionResumeInstalled=true;\n\n    function sessionHasEntered(){\n        try{\n            return window.sessionStorage.getItem(STARTUP_SESSION_READY_KEY)==="1";\n        }catch(_){\n            return false;\n        }\n    }\n\n    function rememberEnteredSession(){\n        try{\n            window.sessionStorage.setItem(STARTUP_SESSION_READY_KEY,"1");\n        }catch(_){ }\n    }\n\n    function persistBeforeSuspend(){\n        try{\n            if(typeof saveGame==="function"){ saveGame(); }\n        }catch(_){ }\n    }\n\n    if(sessionHasEntered()){\n        const startupRoot=document.getElementById("startupLoader");\n        if(startupRoot){\n            startupRoot.hidden=true;\n            startupRoot.dataset.sessionResume="1";\n            startupRoot.setAttribute("aria-hidden","true");\n        }\n    }\n\n    document.addEventListener("v173.20:startup-entered",rememberEnteredSession);\n\n    document.addEventListener("visibilitychange",function(){\n        if(document.hidden){ persistBeforeSuspend(); }\n    });\n\n    window.addEventListener("pagehide",persistBeforeSuspend);\n\n})();\n\n'''
if "V173.41 — MOBILE SESSION RESUME / BACKGROUND SAVE" in s:
    raise SystemExit("V173.41 session resume already installed")
s=once(s,anchor,block,"SAVE_KEY lifecycle anchor")
p.write_text(s)

# 2) Release/cache version.
p=Path("js/20-anonymous-20.js")
s=p.read_text()
s=once(s,f'const V_ASSET_VERSION="{OLD}";',f'const V_ASSET_VERSION="{NEW}";',"asset version")
p.write_text(s)

p=Path("index.html")
s=p.read_text()
s=once(s,f'<title>四象江湖傳 V{OLD}</title>',f'<title>四象江湖傳 V{NEW}</title>',"document title")
s=once(s,f'id="v{OLD}-home-version-badge-style"',f'id="v{NEW}-home-version-badge-style"',"badge style id")
s=once(s,f'aria-label="目前版本 V{OLD}"',f'aria-label="目前版本 V{NEW}"',"badge aria")
s=once(s,f'>V{OLD}</div>',f'>V{NEW}</div>',"badge text")
for entry in RELEASE_ENTRIES:
    s=once(s,f'{entry}?v={OLD}',f'{entry}?v={NEW}',f'release entry {entry}')
p.write_text(s)

# 3) Existing release assertions: only update actual current-release contracts.
# Do not touch historical VFX/stage-specific cache keys.
old_esc=OLD.replace(".","\\.")
new_esc=NEW.replace(".","\\.")
for test_path in sorted(Path("tests").glob("*.js")):
    text=test_path.read_text()

    # Loader's authoritative current release value.
    text=text.replace(
        f'V_ASSET_VERSION="{old_esc}"',
        f'V_ASSET_VERSION="{new_esc}"'
    )
    text=text.replace(
        f'V_ASSET_VERSION="{OLD}"',
        f'V_ASSET_VERSION="{NEW}"'
    )

    # Current document title / HUD badge release assertions.
    text=text.replace(
        f'<title>四象江湖傳 V{old_esc}<\\/title>',
        f'<title>四象江湖傳 V{new_esc}<\\/title>'
    )
    text=text.replace(
        f'<title>四象江湖傳 V{OLD}</title>',
        f'<title>四象江湖傳 V{NEW}</title>'
    )
    text=text.replace(
        f'aria-label="目前版本 V{old_esc}"',
        f'aria-label="目前版本 V{new_esc}"'
    )
    text=text.replace(
        f'aria-label="目前版本 V{OLD}"',
        f'aria-label="目前版本 V{NEW}"'
    )
    text=text.replace(
        f'v{old_esc}-home-version-badge-style',
        f'v{new_esc}-home-version-badge-style'
    )
    text=text.replace(
        f'v{OLD}-home-version-badge-style',
        f'v{NEW}-home-version-badge-style'
    )
    text=text.replace(
        f'>V{old_esc}<\\/div>',
        f'>V{new_esc}<\\/div>'
    )
    text=text.replace(
        f'>V{OLD}</div>',
        f'>V{NEW}</div>'
    )

    # CI release entries only. This deliberately excludes touch-lock, VFX,
    # startup artwork, creation CSS, etc. unless CI declares them release entries.
    for entry in RELEASE_ENTRIES:
        escaped=entry.replace("/","\\/").replace(".","\\.")
        text=text.replace(
            f'{escaped}\\?v={old_esc}',
            f'{escaped}\\?v={new_esc}'
        )
        text=text.replace(
            f'{entry}?v={OLD}',
            f'{entry}?v={NEW}'
        )

    test_path.write_text(text)

# 4) Focused behavior regression.
Path("tests/v173.41-session-resume.test.js").write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");

const keyIndex=main.indexOf('const STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";');
const start=main.lastIndexOf("/* =====================================================",keyIndex);
const end=main.indexOf("let deleteAllCharactersInProgress",keyIndex);
assert.ok(keyIndex>=0 && start>=0 && end>keyIndex,"V173.41 lifecycle block must live in js/00-main.js");
const block=main.slice(start,end);

function harness(initialReady){
    const documentListeners={};
    const windowListeners={};
    const store=new Map(initialReady?[["sixiang_startup_session_ready_v1","1"]]:[]);
    const root={hidden:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=String(v);}};
    let saves=0;
    const context={
        document:{
            hidden:false,
            getElementById(id){return id==="startupLoader"?root:null;},
            addEventListener(type,fn){documentListeners[type]=fn;}
        },
        sessionStorage:{
            getItem(k){return store.has(k)?store.get(k):null;},
            setItem(k,v){store.set(k,String(v));}
        },
        saveGame(){saves++;}
    };
    context.window=context;
    context.window.addEventListener=(type,fn)=>{windowListeners[type]=fn;};
    vm.createContext(context);
    vm.runInContext(block,context);
    return {context,root,store,documentListeners,windowListeners,get saves(){return saves;}};
}

{
    const h=harness(false);
    assert.equal(h.root.hidden,false,"first entry must still show the long startup loader");
    h.documentListeners["v173.20:startup-entered"]();
    assert.equal(h.store.get("sixiang_startup_session_ready_v1"),"1");
}

{
    const h=harness(true);
    assert.equal(h.root.hidden,true,"same-tab reload must skip the long loader");
    assert.equal(h.root.dataset.sessionResume,"1");
    assert.equal(h.root.attributes["aria-hidden"],"true");
    h.context.document.hidden=true;
    h.documentListeners.visibilitychange();
    assert.equal(h.saves,1,"backgrounding must immediately save");
    h.windowListeners.pagehide();
    assert.equal(h.saves,2,"pagehide must also persist before renderer eviction");
}

assert.match(loader,/const V_ASSET_VERSION="173\.41"/);
assert.match(index,/<title>四象江湖傳 V173\.41<\/title>/);
assert.match(index,/js\/00-main\.js\?v=173\.41/);
assert.match(index,/js\/20-anonymous-20\.js\?v=173\.41/);
console.log("✓ V173.41 same-session resume and background save regression passed");
''')

# 5) Handoff.
p=Path("HANDOFF.md")
s=p.read_text()
entry='''\n## V173.41 手機背景恢復／啟動動畫工作階段\n- 同一個瀏覽器分頁工作階段首次完成12～15秒啟動並點擊進入後，以 sessionStorage 記錄已進入；同分頁後續因 Android/Chrome renderer 回收而重載時，`js/00-main.js` 會立即隱藏 startup loader，不再要求等待完整啟動動畫。\n- `visibilitychange -> hidden` 與 `pagehide` 會立即呼叫現有 `saveGame()`，降低 Android 背景回收造成的未存進度風險。\n- 關閉分頁／新的瀏覽器工作階段仍會正常播放首次啟動動畫；沒有使用 Wake Lock、假音訊、reload 攔截或 runtime patch。\n- 本輪只修改 dev，不修改 main。\n'''
p.write_text(entry+s)

print("V173.41 session resume changes staged")
