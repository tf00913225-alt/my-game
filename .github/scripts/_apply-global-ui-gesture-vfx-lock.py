from pathlib import Path
import json

ROOT=Path('.')

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def write(path,text):
    (ROOT/path).write_text(text,encoding='utf-8')

def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old,new,1)

# 1) Global touch/browser interaction owner.
touch_path='js/01-stage-v8-touch-lock.js'
touch=read(touch_path)
marker='''    window.addEventListener(\n        "gesturestart",'''
insert='''    /*\n       全遊戲瀏覽器原生互動鎖：\n       - 單指仍依既有 scroll whitelist 正常捲動。\n       - 兩指以上永遠不交給瀏覽器做 pinch zoom。\n       - 非文字輸入 UI 不開啟長按 context menu、不原生拖曳、不文字選取。\n       這是全域 owner，禁止各頁另疊長按／縮放補丁。\n    */\n    function isGameSurfaceTarget(target){\n        return !!(\n            target &&\n            target.closest &&\n            target.closest("#game-stage")\n        );\n    }\n\n    function isEditableGameControl(target){\n        return !!(\n            target &&\n            target.closest &&\n            target.closest('input, textarea, [contenteditable="true"]')\n        );\n    }\n\n    document.addEventListener(\n        "touchmove",\n        function(event){\n            if(\n                isGameSurfaceTarget(event.target) &&\n                event.touches &&\n                event.touches.length>1\n            ){\n                event.preventDefault();\n            }\n        },\n        {capture:true,passive:false}\n    );\n\n    document.addEventListener(\n        "contextmenu",\n        function(event){\n            if(\n                isGameSurfaceTarget(event.target) &&\n                !isEditableGameControl(event.target)\n            ){\n                event.preventDefault();\n            }\n        },\n        {capture:true}\n    );\n\n    document.addEventListener(\n        "dragstart",\n        function(event){\n            if(\n                isGameSurfaceTarget(event.target) &&\n                !isEditableGameControl(event.target)\n            ){\n                event.preventDefault();\n            }\n        },\n        {capture:true}\n    );\n\n    document.addEventListener(\n        "selectstart",\n        function(event){\n            if(\n                isGameSurfaceTarget(event.target) &&\n                !isEditableGameControl(event.target)\n            ){\n                event.preventDefault();\n            }\n        },\n        {capture:true}\n    );\n\n    document.addEventListener(\n        "wheel",\n        function(event){\n            if(\n                event.ctrlKey &&\n                isGameSurfaceTarget(event.target)\n            ){\n                event.preventDefault();\n            }\n        },\n        {capture:true,passive:false}\n    );\n\n    window.addEventListener(\n        "gesturestart",'''
touch=replace_once(touch,marker,insert,'touch global guard insertion')
write(touch_path,touch)

# 2) Global image/media native-callout protection in the existing base CSS owner.
css_path='css/00-main.css'
css=read(css_path)
css_marker='''#game-stage > #app{'''
css_insert='''/*\n   全遊戲圖片／視覺媒體禁止瀏覽器原生長按、拖曳與選取。\n   不使用 pointer-events:none，避免破壞既有按鈕／圖片點擊行為。\n*/\n#game-stage img,\n#game-stage picture,\n#game-stage svg,\n#game-stage canvas{\n    -webkit-user-select:none;\n    user-select:none;\n    -webkit-user-drag:none;\n    -webkit-touch-callout:none;\n}\n\n#game-stage > #app{'''
css=replace_once(css,css_marker,css_insert,'base CSS interaction guard insertion')
write(css_path,css)

# 3) V173.51 management QA must not own/hide combat VFX.
battle_path='js/54-v173.51-battle-qa.js'
battle=read(battle_path)
old_sync='''function syncManagement(){const shell=document.getElementById("characterPage")||document.getElementById("characterModal");const tab=document.getElementById("characterTabContent");const open=!inBattle()&&!!(tab&&visible(tab)&&(!shell||visible(shell)));if(document.body.classList.contains("v17351-management-open")!==open)document.body.classList.toggle("v17351-management-open",open);const stage=document.getElementById("v143-skill-stage");if(stage){const nextVisibility=open?"hidden":"";if(stage.style.visibility!==nextVisibility)stage.style.visibility=nextVisibility;}document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice")});ensureExpRowsVisible();}'''
new_sync='''function syncManagement(){\n    /*\n       VFX lifecycle belongs exclusively to V142/V143.  This management QA\n       observer used to hide #v143-skill-stage every 300ms when its broad\n       non-battle heuristic became true.  During a terminal hit battleActive\n       can change before the last visual finishes, which made the final skill\n       name/damage appear while the actual Sprite/VFX vanished.\n       Never write VFX visibility from this subsystem.\n    */\n    document.body.classList.remove("v17351-management-open");\n    document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{\n        if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice");\n    });\n    ensureExpRowsVisible();\n}'''
battle=replace_once(battle,old_sync,new_sync,'remove V173.51 VFX visibility ownership')
write(battle_path,battle)

# 4) Delete the obsolete CSS !important that could override the VFX stage.
qa_css_path='css/53-v173.51-qa.css'
qa_css=read(qa_css_path)
qa_rule='body.v17351-management-open #v143-skill-stage{visibility:hidden!important;pointer-events:none!important}\n'
qa_css=replace_once(qa_css,qa_rule,'','remove V173.51 VFX hide CSS')
write(qa_css_path,qa_css)

# 5) Make the direct touch-lock script participate in the current cache version.
index_path='index.html'
index=read(index_path)
index=replace_once(index,'js/01-stage-v8-touch-lock.js?v=173.39','js/01-stage-v8-touch-lock.js?v=173.62','touch lock cache reference')
write(index_path,index)

release_path=ROOT/'release/release.json'
release=json.loads(release_path.read_text(encoding='utf-8'))
managed=release.setdefault('managedCacheReferences',[])
if 'js/01-stage-v8-touch-lock.js' not in managed:
    managed.append('js/01-stage-v8-touch-lock.js')
release_path.write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# 6) Permanent UI rule.
guide_path='UI_GUIDELINES.md'
guide=read(guide_path)
section='''\n\n## 瀏覽器原生手勢與圖片長按保護（永久規則）\n\n- 《四象江湖傳》正式遊戲區 `#game-stage` **禁止瀏覽器層級的 pinch zoom／雙指縮放**。`index.html` 的 viewport 鎖定只是第一層；`js/01-stage-v8-touch-lock.js` 必須在可捲動容器內也優先攔截兩指以上手勢，不能因 scroll whitelist 而放行瀏覽器縮放。\n- 單指垂直／水平捲動仍依既有 scroll whitelist 正常運作；禁止用全域 `touch-action:none` 粗暴鎖死，避免破壞背包、角色、合成、商店、任務與其他正式捲動區。\n- `#game-stage` 內的圖片、SVG、Canvas 與其他視覺素材不得出現瀏覽器原生「另存圖片／在新分頁開啟／搜尋圖片／分享圖片」長按選單，也不得被原生拖曳或選取。全域事件 owner 固定為 `js/01-stage-v8-touch-lock.js`；CSS 基礎保護固定由 `css/00-main.css` 提供。\n- 禁止為單一頁面新增第二套 contextmenu／pinch-zoom workaround。新增任何角色、背包、裝備、技能、商店、副本、地圖、彈窗或未來 UI，都必須自動繼承上述全域規則。\n- 文字輸入欄位（`input`／`textarea`／明確 `contenteditable=true`）可保留必要的文字編輯行為；不得為了禁止圖片長按而破壞創角輸入或其他正式文字輸入。\n- 手機 UI QA 必須實測：單指捲動仍可用、雙指不能縮放、長按圖片沒有任何瀏覽器原生反應、正常點擊／拖曳遊戲控制仍可用。\n'''
if '## 瀏覽器原生手勢與圖片長按保護（永久規則）' not in guide:
    guide=guide.rstrip()+section+'\n'
write(guide_path,guide)

# 7) Handoff owner note.
handoff_path='HANDOFF.md'
handoff=read(handoff_path)
handoff_note='''## 2026-09-07 全遊戲手勢／圖片長按／技能 VFX owner 收斂（dev）\n- `js/01-stage-v8-touch-lock.js` 是全遊戲瀏覽器手勢唯一 owner：既有單指 scroll whitelist 保留，但兩指以上在任何 `#game-stage` 內位置一律阻止瀏覽器 pinch zoom；非文字輸入 UI 的 contextmenu／dragstart／selectstart 亦全域阻止。\n- `css/00-main.css` 是圖片／SVG／Canvas 原生長按與拖曳的基礎 CSS owner；不使用 `pointer-events:none`，避免破壞正常遊戲點擊。\n- `index.html` 的直接 touch-lock 載入已跟現行 Cache Version 173.62 對齊，`release/release.json` 將該檔納入 managed cache references，避免之後修改 touch owner 卻仍載入舊 query。\n- 技能演出仍由 `js/37-v142-skill-animation.js`（gate／時序）＋ `js/39-v143-skill-animation.js`（Sprite/VFX renderer）唯一負責。`js/54-v173.51-battle-qa.js` 與 `css/53-v173.51-qa.css` 不再碰 `#v143-skill-stage` visibility，避免終結一擊時 battleActive 先切換而把尚未結束的 VFX 藏掉。\n- Game/Cache Version 維持 173.62；本批需經 Repository checks、DEV deployed SHA 驗證與手機實機長按／pinch／VFX 驗收後才可標 VERIFIED。\n\n'''
if not handoff.startswith('## 2026-09-07 全遊戲手勢／圖片長按／技能 VFX owner 收斂（dev）'):
    handoff=handoff_note+handoff
write(handoff_path,handoff)

# 8) Update V173.51 regression expectation.
qa_test_path='tests/v173.51-qa.test.js'
qa_test=read(qa_test_path)
old_assert='assert.match(css,/v17351-management-open #v143-skill-stage\\{visibility:hidden/);'
new_assert='assert.doesNotMatch(css,/v17351-management-open #v143-skill-stage/);\nassert.doesNotMatch(battle,/stage\\.style\\.visibility/);'
qa_test=replace_once(qa_test,old_assert,new_assert,'V173.51 VFX regression assertion')
write(qa_test_path,qa_test)

# 9) New global behavior regression test.
new_test=ROOT/'tests/ui-global-browser-interaction-lock.test.js'
new_test.write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchSource=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const baseCss=fs.readFileSync("css/00-main.css","utf8");
const battleQa=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const qaCss=fs.readFileSync("css/53-v173.51-qa.css","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const release=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const guide=fs.readFileSync("UI_GUIDELINES.md","utf8");

assert.match(index,/maximum-scale=1\.0,user-scalable=no/);
assert.match(index,/js\/01-stage-v8-touch-lock\.js\?v=173\.62/);
assert.ok(release.managedCacheReferences.includes("js/01-stage-v8-touch-lock.js"));
assert.match(baseCss,/#game-stage img,[\s\S]*?-webkit-touch-callout:none/);
assert.match(touchSource,/event\.touches[\s\S]*?event\.touches\.length>1[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"contextmenu"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"dragstart"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"selectstart"[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchSource,/"wheel"[\s\S]*?event\.ctrlKey/);
assert.match(guide,/禁止瀏覽器層級的 pinch zoom/);
assert.match(guide,/長按圖片沒有任何瀏覽器原生反應/);

assert.doesNotMatch(qaCss,/v17351-management-open #v143-skill-stage/);
assert.doesNotMatch(battleQa,/stage\.style\.visibility/);
assert.match(animation,/stage\.id="v143-skill-stage"[\s\S]*?stage\.style\.visibility="visible"/);

const listeners={};
const winListeners={};
const gameRoot={};
const scroller={
  nodeType:1,
  matches:()=>true,
  parentElement:null,
  scrollHeight:900,
  clientHeight:300,
  scrollWidth:300,
  clientWidth:300
};
const target={
  nodeType:1,
  parentElement:scroller,
  matches:()=>false,
  closest(selector){
    if(selector==="#game-stage") return gameRoot;
    if(selector.includes("input")||selector.includes("textarea")||selector.includes("contenteditable")) return null;
    return null;
  }
};
const editable={
  nodeType:1,
  parentElement:null,
  matches:()=>false,
  closest(selector){
    if(selector==="#game-stage") return gameRoot;
    if(selector.includes("input")) return editable;
    return null;
  }
};
const outside={nodeType:1,parentElement:null,matches:()=>false,closest:()=>null};
const document={
  documentElement:{},
  addEventListener(name,handler,options){(listeners[name]??=[]).push({handler,options});}
};
const windowObj={
  getComputedStyle(){return {overflowY:"auto",overflowX:"hidden"};},
  addEventListener(name,handler,options){(winListeners[name]??=[]).push({handler,options});}
};
vm.runInNewContext(touchSource,{document,window:windowObj});

function fire(name,event){
  for(const entry of listeners[name]||[]) entry.handler(event);
}
function evt(target,extra={}){
  let prevented=false;
  return Object.assign({target,preventDefault(){prevented=true;},get prevented(){return prevented;}},extra);
}

const single=evt(target,{touches:[{}]});
fire("touchmove",single);
assert.equal(single.prevented,false,"single-finger scroll inside whitelisted scroller must remain native");

const pinch=evt(target,{touches:[{},{}]});
fire("touchmove",pinch);
assert.equal(pinch.prevented,true,"two-finger pinch must be blocked even inside a whitelisted scroller");

const menu=evt(target);
fire("contextmenu",menu);
assert.equal(menu.prevented,true,"game UI context menu must be blocked");

const editMenu=evt(editable);
fire("contextmenu",editMenu);
assert.equal(editMenu.prevented,false,"text input editing must remain available");

const outsideMenu=evt(outside);
fire("contextmenu",outsideMenu);
assert.equal(outsideMenu.prevented,false,"browser UI outside game-stage is not owned by the game");

const drag=evt(target);
fire("dragstart",drag);
assert.equal(drag.prevented,true,"native media drag must be blocked");

console.log("✓ global browser interaction lock and VFX ownership regression");
''',encoding='utf-8')

# 10) Requirement batch.
batch={
  'schemaVersion':1,
  'batchId':'2026-09-07-global-ui-gesture-vfx-lock',
  'baseBranch':'dev',
  'baseCommit':'91eafa0b2efe9ac50f88787fa8d8dd60c7e9d61c',
  'officialVersion':'173.62',
  'officialVersionBumpAllowed':False,
  'overallStatus':'IMPLEMENTED_PENDING_DEV_VISUAL_VERIFICATION',
  'requirements':[
    {'id':'GLOBAL-UI-01','status':'IMPLEMENTED','requirement':'所有正式遊戲 UI 禁止瀏覽器 pinch zoom；單指合法捲動仍正常','evidence':['js/01-stage-v8-touch-lock.js','index.html','tests/ui-global-browser-interaction-lock.test.js']},
    {'id':'GLOBAL-UI-02','status':'IMPLEMENTED','requirement':'所有正式遊戲圖片／視覺素材長按不出現另存、開新分頁、搜尋、分享等原生反應，且不得原生拖曳／選取','evidence':['js/01-stage-v8-touch-lock.js','css/00-main.css','UI_GUIDELINES.md','tests/ui-global-browser-interaction-lock.test.js']},
    {'id':'GLOBAL-UI-03','status':'IMPLEMENTED','requirement':'技能 VFX 不再被角色管理 QA visibility 規則隱藏，終結一擊亦由 V142/V143 完整掌控演出','evidence':['js/54-v173.51-battle-qa.js','css/53-v173.51-qa.css','js/39-v143-skill-animation.js','tests/v173.51-qa.test.js','tests/ui-global-browser-interaction-lock.test.js']}
  ],
  'automatedVerification':'PENDING_CI',
  'visualVerification':'PENDING_DEV_PHONE_TEST'
}
batch_path=ROOT/'release/requirement-batches/2026-09-07-global-ui-gesture-vfx-lock.json'
batch_path.write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

print('applied global UI gesture/long-press/VFX owner fixes')
