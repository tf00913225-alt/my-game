from pathlib import Path
import re


def function_span(text, name):
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        return None
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"missing brace: {name}")
    depth = 0
    quote = None
    escape = False
    i = brace
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
        else:
            if ch in ("'", '"', '`'):
                quote = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    while end < len(text) and text[end] in " \t":
                        end += 1
                    if end < len(text) and text[end] == ";":
                        end += 1
                    while end < len(text) and text[end] in "\r\n":
                        end += 1
                    return start, end
        i += 1
    raise RuntimeError(f"unterminated function: {name}")


def replace_function(text, name, replacement):
    span = function_span(text, name)
    if not span:
        raise RuntimeError(f"function not found: {name}")
    return text[:span[0]] + replacement + text[span[1]:]


def remove_section(text, start_marker, end_marker=None):
    start = text.find(start_marker)
    if start < 0:
        return text, False
    end = text.find(end_marker, start + len(start_marker)) if end_marker else text.find("/* -----", start + len(start_marker))
    if end < 0:
        raise RuntimeError(f"section end missing: {start_marker}")
    return text[:start] + text[end:], True


# V143 system compatibility API remains, but the old four-corner visual may not.
p = Path("js/38-v143-system-fixes.js")
s = p.read_text()
s = replace_function(s, "syncEarthShieldCard", "function syncEarthShieldCard(){ return; }\n\n    ")
p.write_text(s)

# V149 keeps barrier state/class bookkeeping only; V143 raster status sheet owns visuals.
p = Path("js/43-v149-skill-ui-rules.js")
s = p.read_text()
s = replace_function(
    s,
    "syncBarrierCard",
    '''function syncBarrierCard(card,entity){
        if(!card){ return; }
        card.classList.toggle("v149-has-barrier",!!barrierState(entity));
    }

    '''
)
s = s.replace("barrierCornerCount:true,", "barrierCornerCount:false,")
s = s.replace("wordCirclePerCharacter:true,", "proceduralSkillFallback:false,")
p.write_text(s)

# V155 may own the monster-only skill definition, never the VFX manifest.
p = Path("js/46-v155-dev-fixes.js")
s = p.read_text()
marker = '        const manifest=window.v143SkillAnimationManifest;'
start = s.find(marker)
if start >= 0:
    if_start = s.find('if(manifest){', start)
    if if_start < 0:
        raise RuntimeError("V155 manifest block missing")
    brace = s.find('{', if_start)
    depth = 0
    quote = None
    escape = False
    i = brace
    while i < len(s):
        ch = s[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
        else:
            if ch in ("'", '"', '`'):
                quote = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    while end < len(s) and s[end] in " \t\r\n":
                        end += 1
                    s = s[:start] + s[end:]
                    break
        i += 1
p.write_text(s)

# Remove old V141 procedural state CSS at source.
p = Path("css/38-v141-system-expansion.css")
s = p.read_text()
s, _ = remove_section(s, "/* ----- Persistent card state effects ----- */")
p.write_text(s)

# Remove old V143 four-corner Earth Shield CSS.
p = Path("css/40-v143-combat-dungeon-polish.css")
s = p.read_text()
s, _ = remove_section(
    s,
    "/* 7. Wanxiang Earth Shield:",
    "/* 2. V142's full-screen generic caption is retired. */"
)
p.write_text(s)

# Remove downstream selector reference to retired Earth Shield node.
p = Path("css/42-v146-system-polish.css")
s = p.read_text()
s = s.replace(
    '#battlePage .v146-defeated .v141-effect,\n#battlePage .v146-defeated .v143-earth-shield-effect{display:none !important;}',
    '#battlePage .v146-defeated .v141-effect{display:none !important;}'
)
p.write_text(s)

# Remove V149 barrier-corner CSS by the actual selector, regardless of historical comment changes.
p = Path("css/44-v149-skill-ui-rules.css")
s = p.read_text()
selector = '#game-stage #battlePage .v149-barrier-corners{'
start = s.find(selector)
if start >= 0:
    comment_start = s.rfind('/*', 0, start)
    if comment_start >= 0 and start - comment_start < 240:
        start = comment_start
    end_marker = "/* A revived enemy must immediately return to the normal living-card brightness. */"
    end = s.find(end_marker, start)
    if end < 0:
        living_selector = '#game-stage #battlePage .battle-monster.v149-living-monster{'
        end = s.find(living_selector, start)
    if end < 0:
        raise RuntimeError("V149 barrier CSS end boundary missing")
    keep = '''#game-stage #battlePage .battle-monster.v149-has-barrier .v141-monster-shield-bar{
    display:none !important;
}

'''
    s = s[:start] + keep + s[end:]
p.write_text(s)

# Fire historical source assertions now follow the shared statusSheet helper contract.
p = Path("tests/v153-fire-vfx.test.js")
s = p.read_text()
s = s.replace(
    'assert.match(animation,/burn:\\{src:"assets\\/vfx\\/fire\\/burn-loop\\.png\\?v=165",columns:4,rows:2,frames:8,duration:800,collection:"statusEffects"\\}/);',
    'assert.match(animation,/burn:statusSheet\\("assets\\/vfx\\/fire\\/burn-loop\\.png\\?v=165",800,"statusEffects"\\)/);'
)
s = s.replace(
    'assert.match(animation,/rage:\\{src:"assets\\/vfx\\/fire\\/rage-buff-loop\\.png\\?v=165",columns:4,rows:2,frames:8,duration:1000,collection:"activeBuffs"\\}/);',
    'assert.match(animation,/rage:statusSheet\\("assets\\/vfx\\/fire\\/rage-buff-loop\\.png\\?v=165",1000,"activeBuffs"\\)/);'
)
p.write_text(s)

# V149 historical tests now enforce removal rather than retired fallback/corners.
p = Path("tests/v149-skill-ui-rules.test.js")
s = p.read_text()
start = s.find('test("word-circle animation emits one circle per character without replacing sprite sheets"')
if start >= 0:
    end = s.find('\ntest("Barrier corners, revive brightness, rank colours and reflect label are final rules"', start)
    if end < 0:
        raise RuntimeError("V149 word-circle test boundary missing")
    block = '''test("procedural word-circle fallback is retired",()=>{
    assert.doesNotMatch(source,/installWordCircleDirector|v149-word-/);
    assert.doesNotMatch(css,/v149-word-circle-stage/);
    assert.match(animationSource,/missingVisuals/);
});
'''
    s = s[:start] + block + s[end:]
start = s.find('test("Barrier corners, revive brightness, rank colours and reflect label are final rules"')
if start >= 0:
    end = s.find('\nconsole.log(', start)
    if end < 0:
        raise RuntimeError("V149 barrier test boundary missing")
    block = '''test("Barrier is raster-owned while revive, rank and reflect feedback remain",()=>{
    assert.match(source,/remove\\("dead","dying","v146-defeated"\\)/);
    assert.match(source,/setTimeout\\(\\(\\)=>syncMonsterCard\\(index\\),1900\\)/);
    assert.doesNotMatch(source,/v149-barrier-corners/);
    assert.doesNotMatch(css,/v149-barrier-corners|v149BarrierCornerPulse/);
    assert.match(animationSource,/barrier:statusSheet\\("assets\\/vfx\\/earth\\/barrier-loop\\.png\\?v=173\\.39",1200,"activeBuffs"/);
    assert.match(css,/battle-monster\\.v149-has-barrier \\.v141-monster-shield-bar[\\s\\S]*display:none/);
    assert.match(css,/data-rank="elite"[\\s\\S]*#ff9f43/);
    assert.match(css,/data-rank="boss"[\\s\\S]*#ff5f9d/);
    assert.match(source,/反傷HP-/);
    assert.match(css,/\\.v149-reflect-popup/);
});
'''
    s = s[:start] + block + s[end:]
p.write_text(s)

# Permanent owner regression extended to secondary status owners and WebGL/Shader paths.
p = Path("tests/v174-raster-only-combat-vfx-owner.test.js")
s = p.read_text()
decl = '''const v143fixes=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const v155=fs.readFileSync("js/46-v155-dev-fixes.js","utf8");
const css141=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const css146=fs.readFileSync("css/42-v146-system-polish.css","utf8");
'''
if 'const v143fixes=' not in s:
    s = s.replace('const v142=', decl + 'const v142=', 1)
block = '''
test("secondary status owners cannot recreate procedural combat VFX",()=>{
    assert.doesNotMatch(v143fixes,/v143-earth-shield-effect/);
    assert.doesNotMatch(v155,/v143SkillAnimationManifest/);
    assert.doesNotMatch(css141,/\\.v141-effect-canvas|\\.v141-effect-burn|v141BurnFlicker|v141StunOrbit/);
    assert.doesNotMatch(css143,/v143-earth-shield-effect|v143EarthCornerBreath/);
    assert.doesNotMatch(css146,/v143-earth-shield-effect/);
    assert.doesNotMatch(css149,/v149-barrier-corners|v149BarrierCornerPulse/);
    assert.doesNotMatch([v141,v142,v143,v143fixes,v149,v155,abyss].join("\\n"),/WebGLRenderingContext|createShader|shaderSource|getContext\\(["']webgl/i);
});
'''
if 'secondary status owners cannot recreate procedural combat VFX' not in s:
    pos = s.rfind('console.log(')
    if pos < 0:
        raise RuntimeError("V174 console marker missing")
    s = s[:pos] + block + '\n' + s[pos:]
p.write_text(s)

# Record the authoritative owner rule for future work.
p = Path("HANDOFF.md")
s = p.read_text()
note = '''

## 2026-09-09 — 戰鬥 VFX 單一 owner 收斂
- `js/39-v143-skill-animation.js` 是巡怪、日常／深淵副本、玩法／活動與 BOSS 戰鬥的唯一技能 VFX 與持續狀態 Sprite Sheet owner。
- 正式戰鬥視覺只允許 PNG／WebP Sprite Sheet 與狀態循環圖；V142 僅保留 action gate／時序相容，不再繪製視覺。
- 禁止 CSS／JavaScript 程序式技能替代動畫、Canvas、SVG、WebGL／Shader fallback；正式素材缺失時只記錄 missing visual，不得退回舊 renderer。
- `js/43-v149-skill-ui-rules.js`、`js/46-v155-dev-fixes.js`、`js/59-abyss-two-tier-runtime.js` 等後載入規則／副本模組不得改寫 `v143SkillAnimationManifest` 或 `v142SkillAnimationDirector.play`。
- 萬象土盾、結界與其他 Buff／Debuff 視覺由 V143 `RAW_STATUS_SPRITES` 正式循環圖呈現，不再建立舊四角／粒子 CSS 視覺。
'''
if '## 2026-09-09 — 戰鬥 VFX 單一 owner 收斂' not in s:
    s += note
p.write_text(s)
