from pathlib import Path


def edit(path, pairs):
    p = Path(path)
    text = p.read_text()
    for old, new in pairs:
        if old not in text:
            raise SystemExit(f"missing expected block in {path}: {old[:120]!r}")
        text = text.replace(old, new, 1)
    p.write_text(text)


# Shared nav: V148 owns the semantic nav class even when an older module created
# the node first; V152 owns the final 420x84 / 72px presentation.
edit("js/42-v148-combat-dungeon-fixes.js", [
    (
        '        if(!nav||!contextActive){ return; }\n',
        '        if(!nav||!contextActive){ return; }\n'
        '        if(nav.classList&&typeof nav.classList.add==="function"){ nav.classList.add("v148-context-nav"); }\n'
    )
])
edit("css/45-v152-dev-fixes.css", [
    (
        '#game-stage #app.v141-dungeon-active #v141DungeonNav,\n'
        '#game-stage #app.v141-dungeon-active #v141DungeonNav[data-v146-columns="4"],\n'
        '#game-stage #app.v141-dungeon-active #v141DungeonNav[data-v146-columns="5"]{',
        '#game-stage #v141DungeonNav.v148-context-nav,\n'
        '#game-stage #v141DungeonNav.v148-context-nav[data-v146-columns="4"],\n'
        '#game-stage #v141DungeonNav.v148-context-nav[data-v146-columns="5"]{'
    ),
    (
        '    #game-stage #app.v141-dungeon-active #v141DungeonNav{\n'
        '        height:80px !important;\n'
        '    }',
        '    #game-stage #v141DungeonNav.v148-context-nav{\n'
        '        height:80px !important;\n'
        '    }'
    )
])

# Gameplay panel: remove the owner-drawn bottom ornament reported in the screenshot.
edit("css/gameplay-boss-tower.css", [
    (
        '#game-stage .gameplay-large-panel::before,\n'
        '#game-stage .gameplay-large-panel::after{',
        '#game-stage .gameplay-large-panel::before{'
    ),
    (
        '#game-stage .gameplay-large-panel::before{ top:8px; }\n'
        '#game-stage .gameplay-large-panel::after{ bottom:8px; }',
        '#game-stage .gameplay-large-panel::before{ top:8px; }'
    )
])

# Battle art: capture CSS-owned artwork before the cardless class masks the card
# background. Keep HP/SP/name inside the existing monster-card footprint.
edit("js/54-v173.51-battle-qa.js", [
    (
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-hp{\n'
        '    position:absolute!important;left:50%!important;bottom:13px!important;',
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-hp{\n'
        '    position:absolute!important;left:50%!important;bottom:29px!important;'
    ),
    (
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-sp{\n'
        '    position:absolute!important;left:50%!important;bottom:0!important;',
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-sp{\n'
        '    position:absolute!important;left:50%!important;bottom:16px!important;'
    ),
    (
        '    position:absolute!important;left:-4px!important;right:-4px!important;top:calc(100% + 3px)!important;',
        '    position:absolute!important;left:-4px!important;right:-4px!important;top:auto!important;bottom:0!important;'
    ),
    (
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.v174-battle-art{\n'
        '    inset:2px 2px 26px!important;',
        '#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.v174-battle-art{\n'
        '    inset:2px 2px 42px!important;'
    ),
    (
        '#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card.v174-cardless-unit>.v174-battle-art{\n'
        '    inset:2px 2px 26px!important;',
        '#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card.v174-cardless-unit>.v174-battle-art{\n'
        '    inset:2px 2px 42px!important;'
    ),
    (
        'function syncUnitArtwork(card,kind){\n'
        '    if(!card)return;\n'
        '    card.classList.add("v174-cardless-unit");\n'
        '    let art=card.querySelector(":scope > .v174-battle-art");\n'
        '    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}\n'
        '    const source=battleArtworkSource(card,kind);\n'
        '    if(source)art.style.backgroundImage=source;\n'
        '    card.style.setProperty("background-image","none","important");\n'
        '}',
        'function syncUnitArtwork(card,kind){\n'
        '    if(!card)return;\n'
        '    /* Capture CSS-owned artwork before v174-cardless-unit masks the card background. */\n'
        '    const source=battleArtworkSource(card,kind);\n'
        '    card.classList.add("v174-cardless-unit");\n'
        '    let art=card.querySelector(":scope > .v174-battle-art");\n'
        '    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}\n'
        '    if(source){\n'
        '        art.style.backgroundImage=source;\n'
        '        card.style.setProperty("background-image","none","important");\n'
        '    }\n'
        '}'
    )
])

# Monster names no longer need to inflate both fixed formation rows.
edit("css/40-v143-combat-dungeon-polish.css", [
    (
        '\n#game-stage #battleMonsterArea .v131-monster-row{\n'
        '    min-height:120px;\n'
        '    padding-bottom:18px;\n'
        '    box-sizing:border-box;\n'
        '    overflow:visible;\n'
        '}\n',
        '\n'
    )
])

# A tall 9:16 target must not make a single-target Sprite scale from portrait
# height. Position still uses the complete visual rect; size uses unit width.
p = Path("js/39-v143-skill-animation.js")
text = p.read_text()
old = 'const targetSize=Math.max(target.rect.width,target.rect.height);'
count = text.count(old)
if count != 2:
    raise SystemExit(f"expected 2 single-target size references, found {count}")
text = text.replace(old, 'const targetSize=Math.max(1,Number(target.rect.width)||0);')
p.write_text(text)

# Update the guards that encoded the broken outside-card identity lane.
edit("tests/shared-nav-vfx-battle-layout-20260914.test.js", [
    (
        'const navCss=read("css/38-v141-system-expansion.css");',
        'const navCss=read("css/38-v141-system-expansion.css");\n'
        'const finalNavCss=read("css/45-v152-dev-fixes.css");'
    ),
    (
        'assert.match(navCss,/\\.v148-context-nav-active #bottomNav\\{display:none !important;\\}/);',
        'assert.match(navCss,/\\.v148-context-nav-active #bottomNav\\{display:none !important;\\}/);\n'
        'assert.match(finalNav,/classList\\.add\\("v148-context-nav"\\)/);\n'
        'assert.match(finalNavCss,/#v141DungeonNav\\.v148-context-nav,[\\s\\S]*?width:420px !important;[\\s\\S]*?height:84px !important;/);\n'
        'assert.match(finalNavCss,/#v141DungeonNav \\.nav-art-button\\{[\\s\\S]*?height:72px !important;/);'
    ),
    (
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.battle-monster-name\\{[\\s\\S]*?top:calc\\(100% \\+ 3px\\)!important/);',
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.battle-monster-name\\{[\\s\\S]*?top:auto!important;bottom:0!important/);'
    ),
    (
        'assert.match(vfxCss,/battleMonsterArea \\.v131-monster-row\\{[\\s\\S]*?padding-bottom:18px/);',
        'assert.doesNotMatch(vfxCss,/battleMonsterArea \\.v131-monster-row\\{[\\s\\S]*?padding-bottom:18px/);\n'
        'assert.match(battle,/monster-hp\\{[\\s\\S]*?bottom:29px!important/);\n'
        'assert.match(battle,/monster-sp\\{[\\s\\S]*?bottom:16px!important/);'
    )
])
edit("tests/v1741-battle-gameplay-layout-order.test.js", [
    (
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.battle-monster-name\\{[\\s\\S]*?top:calc\\(100% \\+ 3px\\)!important/);',
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.battle-monster-name\\{[\\s\\S]*?top:auto!important;bottom:0!important/);\n'
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.monster-hp\\{[\\s\\S]*?bottom:29px!important/);\n'
        'assert.match(battle,/battle-monster\\.v174-cardless-unit>\\.monster-sp\\{[\\s\\S]*?bottom:16px!important/);'
    )
])

Path("tests/post225-mobile-regressions-20260914.test.js").write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const nav=read("js/42-v148-combat-dungeon-fixes.js");
const navCss=read("css/45-v152-dev-fixes.css");
const panelCss=read("css/gameplay-boss-tower.css");
const battle=read("js/54-v173.51-battle-qa.js");
const vfx=read("js/39-v143-skill-animation.js");
const vfxCss=read("css/40-v143-combat-dungeon-polish.css");

assert.match(nav,/classList\.add\("v148-context-nav"\)/);
assert.match(navCss,/#v141DungeonNav\.v148-context-nav,[\s\S]*?width:420px !important;[\s\S]*?height:84px !important;/);
assert.match(navCss,/#v141DungeonNav \.nav-art-button\{[\s\S]*?height:72px !important;/);
assert.doesNotMatch(panelCss,/\.gameplay-large-panel::after/);

const syncStart=battle.indexOf("function syncUnitArtwork");
const syncEnd=battle.indexOf("function syncResourceNumbers",syncStart);
const sync=battle.slice(syncStart,syncEnd);
assert.ok(sync.indexOf("const source=battleArtworkSource(card,kind)")<sync.indexOf('card.classList.add("v174-cardless-unit")'));
assert.match(sync,/if\(source\)\{[\s\S]*?art\.style\.backgroundImage=source;[\s\S]*?setProperty\("background-image","none","important"\)/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-hp\{[\s\S]*?bottom:29px!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-sp\{[\s\S]*?bottom:16px!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.battle-monster-name\{[\s\S]*?top:auto!important;bottom:0!important/);
assert.doesNotMatch(vfxCss,/battleMonsterArea \.v131-monster-row\{[\s\S]*?min-height:120px/);
assert.equal((vfx.match(/const targetSize=Math\.max\(1,Number\(target\.rect\.width\)\|\|0\);/g)||[]).length,2);
assert.doesNotMatch(vfx,/const targetSize=Math\.max\(target\.rect\.width,target\.rect\.height\)/);
assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?overflow:visible/);
assert.match(vfxCss,/\.v143-vfx-frame\{[\s\S]*?overflow:hidden/);
console.log("post-225 mobile regression guard passed");
''')
