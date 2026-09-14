from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


source_path = "js/54-v173.51-battle-qa.js"
source = read(source_path)
old_mask = "    background-color:transparent!important;background-image:none!important;\n    isolation:isolate!important;\n"
new_mask = "    /* Keep the formal portrait source readable; suppress only the card's own paint. */\n    background-color:transparent!important;background-size:0 0!important;\n    background-repeat:no-repeat!important;\n    isolation:isolate!important;\n"
if source.count(old_mask) != 1:
    raise SystemExit("battle presentation mask owner changed; refusing blind patch")
source = source.replace(old_mask, new_mask, 1)
start = source.index("function portraitImageSource(card){")
end = source.index("function syncResourceNumbers(){", start)
owner = '''function battleArtworkSource(card,kind){
    if(!card)return "";
    const computed=getComputedStyle(card);
    let source="";
    if(kind==="monster")source=String(computed.getPropertyValue("--v152-abyss-portrait")||"").trim();
    if(!source||source==="none")source=String(card.style.backgroundImage||"").trim();
    if(!source||source==="none")source=String(computed.backgroundImage||"").trim();
    return source&&source!=="none"&&!/^linear-gradient/i.test(source)?source:"";
}
function syncUnitArtwork(card,kind){
    if(!card)return;
    const source=battleArtworkSource(card,kind);
    let art=card.querySelector(":scope > .v174-battle-art");
    if(!source){
        card.classList.remove("v174-cardless-unit");
        if(art)art.style.removeProperty("background-image");
        return;
    }
    card.classList.add("v174-cardless-unit");
    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}
    art.style.backgroundImage=source;
}
'''
source = source[:start] + owner + source[end:]
write(source_path, source)

presentation_path = "tests/v174-cardless-battle-presentation.test.js"
presentation = read(presentation_path)
old_assert = "    assert.match(source,/background-image:none!important/);"
if old_assert not in presentation:
    raise SystemExit("presentation mask assertion changed")
presentation = presentation.replace(
    old_assert,
    '    assert.match(source,/background-size:0 0!important/);\n'
    '    assert.doesNotMatch(source,/card\\.style\\.setProperty\\("background-image","none","important"\\)/);',
    1,
)
test_start = presentation.index("test('cardless artwork mirrors every formal portrait source before hiding the original owner'")
presentation = presentation[:test_start] + r'''test('cardless artwork keeps one formal source owner and removes failed fallback patches',()=>{
    assert.doesNotMatch(source,/function portraitImageSource\(card\)/);
    assert.doesNotMatch(source,/monsterPortraitPath/);
    assert.doesNotMatch(source,/dataset\.v174BattleArtwork/);
    assert.doesNotMatch(source,/setProperty\("background-image","none","important"\)/);
    assert.match(source,/function battleArtworkSource\(card,kind\)[\s\S]*?getComputedStyle\(card\)[\s\S]*?computed\.backgroundImage/);
    assert.match(source,/if\(!source\)\{[\s\S]*?classList\.remove\("v174-cardless-unit"\);[\s\S]*?removeProperty\("background-image"\);[\s\S]*?return;/);
    assert.match(source,/art\.style\.backgroundImage=source;/);
    assert.match(source,/background-size:0 0!important/);
    assert.match(source,/img\.v162-abyss-battle-portrait-art\{[\s\S]*?opacity:0!important;[\s\S]*?pointer-events:none!important;/);
    assert.doesNotMatch(source,/removeChild\([^)]*v162-abyss-battle-portrait-art/);
});
'''
write(presentation_path, presentation)

browser_path = "tests/v174-cardless-battle-browser.test.js"
browser = read(browser_path)
old_style = '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#17120d}*{animation-duration:.5s}</style></head><body>'
player_css = "#battlePlayerCard0,#battlePlayerCard1,#battlePlayerCard2{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='116' height='144'%3E%3Crect width='116' height='144' fill='%23456'/%3E%3C/svg%3E\")}" 
new_style = '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#17120d}*{animation-duration:.5s}' + player_css + '</style></head><body>'
if browser.count(old_style) != 1:
    raise SystemExit("browser fixture style owner changed")
browser = browser.replace(old_style, new_style, 1)
marker = "window.__qaBefore=qaRects();"
replacement = "document.querySelectorAll('.battle-player').forEach(function(card){card.style.removeProperty('background-image');});\nwindow.__qaPlayerCssSource=getComputedStyle(document.getElementById('battlePlayerCard0')).backgroundImage;\nwindow.__qaBefore=qaRects();"
if browser.count(marker) != 1:
    raise SystemExit("browser before marker changed")
browser = browser.replace(marker, replacement, 1)
marker = "  var player=document.getElementById('battlePlayerCard0');\n  var art=player.querySelector(':scope > .v174-battle-art');"
replacement = "  var player=document.getElementById('battlePlayerCard0');\n  window.v17351SyncManagement();\n  window.v17351SyncManagement();\n  var art=player.querySelector(':scope > .v174-battle-art');"
if browser.count(marker) != 1:
    raise SystemExit("browser runtime marker changed")
browser = browser.replace(marker, replacement, 1)
marker = "      playerArt:!!art,\n      playerArtBackgroundSize:getComputedStyle(art).backgroundSize,"
replacement = "      playerArt:!!art,\n      playerCssSourceBefore:window.__qaPlayerCssSource,\n      playerInlineBackground:player.style.backgroundImage,\n      playerArtBackground:getComputedStyle(art).backgroundImage,\n      playerArtBackgroundSize:getComputedStyle(art).backgroundSize,"
if browser.count(marker) != 1:
    raise SystemExit("browser result marker changed")
browser = browser.replace(marker, replacement, 1)
marker = '    assert.equal(data.playerArt,true);\n    assert.equal(data.playerArtBackgroundSize,"contain");'
replacement = '    assert.equal(data.playerArt,true);\n    assert.match(data.playerCssSourceBefore,/data:image\\/svg\\+xml/);\n    assert.equal(data.playerInlineBackground,"","presentation must not overwrite the formal player background owner");\n    assert.match(data.playerArtBackground,/data:image\\/svg\\+xml/);\n    assert.equal(data.playerArtBackgroundSize,"contain");'
if browser.count(marker) != 1:
    raise SystemExit("browser assertion marker changed")
browser = browser.replace(marker, replacement, 1)
write(browser_path, browser)
