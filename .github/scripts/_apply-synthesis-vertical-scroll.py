from pathlib import Path
import json


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# CSS owner: the synthesis body is the vertical scroll owner; cards may grow beyond one viewport.
replace_once(
    "css/38-v141-system-expansion.css",
    "#game-stage .v141-synthesis-body{flex:1;min-height:0;overflow:hidden;}\n#game-stage .v141-synthesis-card,#game-stage .v141-synthesis-empty{height:100%;padding:10px;border:1px solid #785a31;border-radius:10px;background:linear-gradient(155deg,#21180f,#0e0b08);box-sizing:border-box;}",
    "#game-stage .v141-synthesis-body{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-gutter:stable;}\n#game-stage .v141-synthesis-card,#game-stage .v141-synthesis-empty{min-height:100%;padding:10px;border:1px solid #785a31;border-radius:10px;background:linear-gradient(155deg,#21180f,#0e0b08);box-sizing:border-box;}\n#game-stage .v141-synthesis-card{height:auto;}\n#game-stage .v141-synthesis-empty{height:100%;}"
)
replace_once(
    "css/38-v141-system-expansion.css",
    "/* ----- Small-height phones: compress, never introduce synthesis/shop scroll ----- */",
    "/* ----- Small-height phones: compress while the synthesis body remains the vertical scroll owner. ----- */"
)
replace_once(
    "css/38-v141-system-expansion.css",
    "touch-action:pan-x;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:thin;}",
    "touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:thin;}"
)

# Late runtime owner: keep wallet/tabs fixed and make only the synthesis content body scroll vertically.
replace_once(
    "js/58-v173.63-functional-fixes.js",
    "    setImp(body,\"flex\",\"1 1 auto\");\n    setImp(body,\"min-height\",\"0\");\n    setImp(body,\"overflow-x\",\"hidden\");\n    setImp(body,\"overflow-y\",\"auto\");\n    setImp(body,\"touch-action\",\"pan-y\");\n}",
    "    setImp(body,\"flex\",\"1 1 auto\");\n    setImp(body,\"min-height\",\"0\");\n    setImp(body,\"overflow\",\"hidden\");\n    setImp(body,\"touch-action\",\"pan-y\");\n    const synthesisBody=body&&body.querySelector(\".v141-synthesis-body\");\n    setImp(synthesisBody,\"flex\",\"1 1 auto\");\n    setImp(synthesisBody,\"min-height\",\"0\");\n    setImp(synthesisBody,\"overflow-x\",\"hidden\");\n    setImp(synthesisBody,\"overflow-y\",\"auto\");\n    setImp(synthesisBody,\"overscroll-behavior-y\",\"contain\");\n    setImp(synthesisBody,\"touch-action\",\"pan-y\");\n}"
)

# Touch lock: whitelist the actual vertical synthesis scroll owner.
replace_once(
    "js/01-stage-v8-touch-lock.js",
    '".home-feature-modal-box, #homeFeatureModalBody, #trainingZoneModalBody, .auto-settings-expanded, " +',
    '".home-feature-modal-box, #homeFeatureModalBody, .v141-synthesis-body, #trainingZoneModalBody, .auto-settings-expanded, " +'
)

# Browser regression: require native vertical scrolling semantics on the synthesis body.
replace_once(
    "tests/ui-synthesis-large-panel-browser.test.js",
    "const record=name=>{void box.offsetHeight;shots.push({name,box:rect(box),wallet:rect(wallet),tabs:rect(tabs),body:rect(body),scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollWidth:body.scrollWidth,clientWidth:body.clientWidth});};",
    "const record=name=>{void box.offsetHeight;const style=getComputedStyle(body);shots.push({name,box:rect(box),wallet:rect(wallet),tabs:rect(tabs),body:rect(body),scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollWidth:body.scrollWidth,clientWidth:body.clientWidth,overflowY:style.overflowY,touchAction:style.touchAction});};"
)
replace_once(
    "tests/ui-synthesis-large-panel-browser.test.js",
    "    assert.ok(shots[1].scrollHeight>shots[1].clientHeight,\"long synthesis content must scroll only inside the synthesis body\");",
    "    assert.ok(shots[1].scrollHeight>shots[1].clientHeight,\"long synthesis content must scroll only inside the synthesis body\");\n    assert.equal(shots[1].overflowY,\"auto\",\"synthesis body must expose native vertical overflow\");\n    assert.match(shots[1].touchAction,/pan-y/,\"synthesis body must allow native vertical touch panning\");"
)

# Touch regression: the global lock must allow vertical gestures from inside the real synthesis owner.
replace_once(
    "tests/v173.45-synthesis-touch-icon.test.js",
    "assert.match(touchLock,/\\.v143-item-picker/);",
    "assert.match(touchLock,/\\.v143-item-picker/);\nassert.match(touchLock,/\\.v141-synthesis-body/);"
)
replace_once(
    "tests/v173.45-synthesis-touch-icon.test.js",
    "picker.scrollWidth=picker.clientWidth;\nassert.equal(window.isInsideAllowedScrollerV78(card),false,\"picker is whitelisted only when horizontal overflow actually exists\");\n\nconsole.log(\"Synthesis horizontal touch and compact talisman checks passed\");",
    "picker.scrollWidth=picker.clientWidth;\nassert.equal(window.isInsideAllowedScrollerV78(card),false,\"picker is whitelisted only when horizontal overflow actually exists\");\n\nconst synthesisBody={\n    nodeType:1,parentElement:body,\n    scrollHeight:920,clientHeight:500,scrollWidth:300,clientWidth:300,\n    computedStyle:{overflowX:\"hidden\",overflowY:\"auto\"},\n    matches:selector=>selector.includes(\".v141-synthesis-body\"),\n    closest:selector=>selector===\"#game-stage\"?stage:null\n};\nconst synthesisChild={\n    nodeType:1,parentElement:synthesisBody,matches:()=>false,\n    closest:selector=>selector===\"#game-stage\"?stage:null\n};\nprevented=false;\nlisteners.get(\"touchmove\")({target:synthesisChild,preventDefault(){ prevented=true; }});\nassert.equal(window.isInsideAllowedScrollerV78(synthesisChild),true,\"synthesis content body must qualify as a vertical scroll owner\");\nassert.equal(prevented,false,\"vertical synthesis touchmove must remain native\");\n\nconsole.log(\"Synthesis horizontal/vertical touch and compact talisman checks passed\");"
)

# Follow-up Requirement Batch: do not bump official version before device visual verification.
batch={
  "schemaVersion":1,
  "batchId":"2026-09-07-synthesis-vertical-scroll",
  "baseBranch":"dev",
  "officialVersion":"173.62",
  "officialVersionBumpAllowed":False,
  "overallStatus":"IMPLEMENTED_PENDING_DEV_VISUAL_VERIFICATION",
  "requirements":[
    {"id":"SCROLL-01","status":"IMPLEMENTED","requirement":"裝備冶煉內頁可原生上下捲動到底，不再裁切底部內容","evidence":["css/38-v141-system-expansion.css","js/58-v173.63-functional-fixes.js","js/01-stage-v8-touch-lock.js"]},
    {"id":"SCROLL-02","status":"IMPLEMENTED","requirement":"材料合成內頁可原生上下捲動到底，不再裁切設計圖升階內容","evidence":["css/38-v141-system-expansion.css","js/58-v173.63-functional-fixes.js","js/01-stage-v8-touch-lock.js"]}
  ],
  "automatedVerification":"PENDING_CI",
  "visualVerification":"PENDING_DEV_PREVIEW"
}
write("release/requirement-batches/2026-09-07-synthesis-vertical-scroll.json",json.dumps(batch,ensure_ascii=False,indent=2)+"\n")

# Handoff records the owner-level follow-up without claiming visual completion.
with Path("HANDOFF.md").open("a",encoding="utf-8") as f:
    f.write("\n\n## 2026-09-07 合成內頁垂直捲動 follow-up（dev）\n")
    f.write("- 使用者手機驗收確認裝備冶煉與材料合成內容仍會在底部裁切；真正垂直 scroll owner 為 `.v141-synthesis-body`，不是外層 `#homeFeatureModalBody`。\n")
    f.write("- `css/38-v141-system-expansion.css` 改為 `.v141-synthesis-body` 原生 `overflow-y:auto` + `touch-action:pan-y`，長內容卡片改 `height:auto; min-height:100%`；冶煉階級橫向 rail 允許 pan-x/pan-y。\n")
    f.write("- `js/58-v173.63-functional-fixes.js` 的 `maximizeSynthesisPanel()` 同步把真正內容 body 設為垂直 scroll owner；`js/01-stage-v8-touch-lock.js` 白名單加入 `.v141-synthesis-body`。\n")
    f.write("- 版本仍維持 V173.62；需等 DEV 實機確認兩頁都能滑到底後才可把本 follow-up 標成 VERIFIED。\n")
