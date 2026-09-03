from pathlib import Path
import re
import sys


def patch_property(path, selector, prop, old, new):
    file=Path(path)
    text=file.read_text()
    pattern=re.compile(r'('+re.escape(selector)+r'\{)(.*?)(\n\})',re.S)
    match=pattern.search(text)
    if not match:
        raise SystemExit(f"selector not found: {selector} in {path}")
    body=match.group(2)
    needle=f"{prop}:{old};"
    if body.count(needle)!=1:
        raise SystemExit(f"property mismatch: {needle} in {selector}")
    body=body.replace(needle,f"{prop}:{new};",1)
    file.write_text(text[:match.start(2)]+body+text[match.end(2):])


def apply():
    patch_property("css/00-main.css",".home-hud-identity","inset-inline-start","4px","7px")
    patch_property("css/00-main.css",".home-hud-kicker","gap","6px","7px")
    patch_property("css/00-main.css",".home-hud-kicker","font-size","8px","10px")
    patch_property("css/00-main.css",".home-hud-kicker","line-height","1","1.15")

    patch_property("css/00-main.css",".home-utility-actions","grid-template-columns","repeat(2,86px)","repeat(2,100px)")
    patch_property("css/00-main.css",".home-utility-actions","padding","0 82px","0 72px")
    patch_property("css/00-main.css",".home-card-utility","grid-template-columns","36px minmax(0,1fr)","42px minmax(0,1fr)")
    patch_property("css/00-main.css",".home-card-utility","height","40px","47px")
    patch_property("css/00-main.css",".home-card-utility .home-card-icon","width","35px","41px")
    patch_property("css/00-main.css",".home-card-utility .home-card-icon","height","38px","45px")
    patch_property("css/00-main.css",".home-card-utility .home-card-label","font-size","10px","12px")
    patch_property("css/00-main.css",".home-card-utility .home-card-label","line-height","38px","45px")

    patch_property("index.html","#game-stage #homePage .home-version-badge","padding","2px 5px 1px","3px 6px 2px")
    patch_property("index.html","#game-stage #homePage .home-version-badge","font-size","7px","9px")

    patch_property("css/42-v146-system-polish.css","#game-stage #homePage .v146-home-roster","margin","1px 10px 0","8px 10px 0")
    patch_property("css/42-v146-system-polish.css","#game-stage #homePage .v146-home-roster","padding","2px 7px","3px 7px")
    patch_property("css/42-v146-system-polish.css","#game-stage #homePage .v146-home-character","height","44px","46px")

    test=Path("tests/v173.28-main-city-lobby.test.js")
    source=test.read_text()
    replacements=[
        (r'inset-inline-start:4px/',r'inset-inline-start:7px/'),
        (r'repeat\(2,86px\)',r'repeat\(2,100px\)'),
        (r'padding:0 82px/',r'padding:0 72px/'),
        (r'height:40px;',r'height:47px;'),
        ('assert.ok((98-86)/98>=.10&&(98-86)/98<=.15);','assert.ok((100-86)/86>=.15&&(100-86)/86<=.20);'),
        ('assert.ok((46-40)/46>=.10&&(46-40)/46<=.15);','assert.ok((47-40)/40>=.15&&(47-40)/40<=.20);'),
        ('assert.equal(88-82,6);','assert.equal(82-72,10);'),
        (r'height:44px/',r'height:46px/'),
        ('const oldRosterHeight=1+(3*2)+2+14+(3*3)+(3*48);\n    const newRosterHeight=1+(2*2)+2+14+(3*2)+(3*44);\n    assert.ok((oldRosterHeight-newRosterHeight)/oldRosterHeight>=.08);\n    assert.ok((oldRosterHeight-newRosterHeight)/oldRosterHeight<=.10);',
         'const previousRosterContainerHeight=(2*2)+2+14+(3*2)+(3*44);\n    const polishedRosterContainerHeight=(3*2)+2+14+(3*2)+(3*46);\n    assert.ok((polishedRosterContainerHeight-previousRosterContainerHeight)/previousRosterContainerHeight>=.05);\n    assert.ok((polishedRosterContainerHeight-previousRosterContainerHeight)/previousRosterContainerHeight<=.08);'),
        ('const rosterHeight=1+(2*2)+2+14+(3*2)+(3*44);','const rosterHeight=8+(3*2)+2+14+(3*2)+(3*46);'),
        ('assert.equal(hudHeight+actionHeight+rosterHeight,560);','assert.equal(hudHeight+actionHeight+rosterHeight,575);')
    ]
    for old,new in replacements:
        if old not in source:
            raise SystemExit(f"main-city expectation not found: {old}")
        source=source.replace(old,new)
    test.write_text(source)

    Path("tests/v173.39-main-city-final-polish.test.js").write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");
const base=read("css/00-main.css");
const index=read("index.html");
const roster=read("css/42-v146-system-polish.css");
const runtime=read("js/41-v146-system-polish.js");
let passed=0;
function test(name,callback){ callback(); passed++; console.log("✓ "+name); }

test("HUD identity grows without changing resource or DEV structure",()=>{
    assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;[\s\S]*?inset-inline-start:7px;/);
    assert.match(base,/\.home-hud-kicker\{[\s\S]*?gap:7px;[\s\S]*?font-size:10px;[\s\S]*?line-height:1\.15;/);
    assert.match(index,/#game-stage #homePage \.home-version-badge\{[\s\S]*?padding:3px 6px 2px;[\s\S]*?font-size:9px;/);
    assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(base,/\.home-test-button\{[\s\S]*?height:16px;[\s\S]*?opacity:\.78/);
    assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});

test("utility buttons grow 15 to 20 percent while preserving a central corridor",()=>{
    assert.match(base,/\.home-utility-actions\{[\s\S]*?grid-template-columns:repeat\(2,100px\);[\s\S]*?justify-content:space-between;[\s\S]*?padding:0 72px;/);
    assert.match(base,/\.home-card-utility\{[\s\S]*?grid-template-columns:42px minmax\(0,1fr\);[\s\S]*?height:47px;/);
    assert.match(base,/\.home-card-utility \.home-card-icon\{[\s\S]*?width:41px;[\s\S]*?height:45px;/);
    assert.match(base,/\.home-card-utility \.home-card-label\{[\s\S]*?font-size:12px;[\s\S]*?line-height:45px;/);
    assert.ok((100-86)/86>=.15&&(100-86)/86<=.20);
    assert.ok((47-40)/40>=.15&&(47-40)/40<=.20);
    assert.equal(420-(72*2)-(100*2),76);
});

test("adventure roster fills lower area without changing avatar or HP SP rules",()=>{
    assert.match(roster,/\.v146-home-roster\{[\s\S]*?gap:2px;[\s\S]*?margin:8px 10px 0;[\s\S]*?padding:3px 7px;/);
    assert.match(roster,/\.v146-home-character\{[\s\S]*?grid-template-columns:43px minmax\(0,1fr\);[\s\S]*?height:46px;/);
    assert.match(roster,/\.v146-home-avatar\{[\s\S]*?width:45px;[\s\S]*?height:45px;[\s\S]*?transform:translateX\(-4px\)/);
    assert.match(roster,/\.v146-home-resource\{[\s\S]*?height:9px;[\s\S]*?margin-inline:2px/);
    const previous=(2*2)+2+14+(3*2)+(3*44);
    const current=(3*2)+2+14+(3*2)+(3*46);
    assert.ok((current-previous)/previous>=.05&&(current-previous)/previous<=.08);
    assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
});

test("forbidden main-city sizes remain unchanged",()=>{
    assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);
    assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
    assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(3,82px\);/);
    assert.doesNotMatch(base,/\.home-card-grid\{[\s\S]{0,220}grid-template-columns:repeat\(4,1fr\)/);
});

test("fixed home height still fits above unchanged navigation",()=>{
    const safeHeight=746.6666667-10-78-(14*2);
    const hudHeight=5+48;
    const actionHeight=1+90+1+256;
    const rosterHeight=8+(3*2)+2+14+(3*2)+(3*46);
    assert.equal(hudHeight+actionHeight+rosterHeight,575);
    assert.ok(hudHeight+actionHeight+rosterHeight<=safeHeight);
    assert.match(base,/#homePage\{[\s\S]{0,420}height:100%;[\s\S]{0,120}overflow:hidden/);
});
console.log("\n"+passed+" V173.39 main-city final-polish tests passed.");
''')


def record():
    path=Path("HANDOFF.md")
    text=path.read_text()
    section='''## V173.39 主城 UI 最後微調（目前 dev）

> 本輪只調整主城既有三個視覺區塊，不重構、不新增 UI、不修改功能事件或遊戲邏輯。

- `css/00-main.css` 仍是主城 HUD 與入口尺寸 owner：四象主城字級由 8px 調為 10px、身份區略右移並維持垂直置中；金幣、經驗池、DEV 結構與大小未改。
- `index.html` 既有 `home-version-badge` 內嵌樣式仍是版本徽章 owner：字級由 7px 調為 9px，僅同步放大既有徽章，不新增任何 HUD 資訊。
- `css/00-main.css` 的離線經驗／系統維持完整底板與金框：86×40 調為 100×47，icon 與文字同比放大，左右各再讓開中央城門；角色／商店與左右六個功能入口尺寸完全不動。
- `css/42-v146-system-polish.css` 仍是冒險隊伍視覺 owner：容器下移 7px，垂直 padding 由 2px 微增至 3px，每列由 44px 微增至 46px；角色排列、45×45 頭像與 HP/SP 規則不變。
- `js/41-v146-system-polish.js` 的 `renderHomeRoster()` 未修改；底部導航、背景、事件、角色資料、金幣／經驗邏輯、DEV、戰鬥、技能與存檔皆未修改。
- 已以實際瀏覽器驗證 1080×1920 核心直向比例與 390×844 手機直向比例：三人隊伍狀態無重疊、無裁切、無頁面捲動，兩顆次級按鈕之間保留中央城門通道。

'''
    marker='---\n\n'
    if section in text or marker not in text:
        raise SystemExit("HANDOFF insertion state invalid")
    path.write_text(text.replace(marker,marker+section,1))


if __name__=="__main__":
    mode=sys.argv[1] if len(sys.argv)>1 else "apply"
    if mode=="apply": apply()
    elif mode=="record": record()
    else: raise SystemExit("unknown mode")
