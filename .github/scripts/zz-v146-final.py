from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise RuntimeError(label + " anchor missing")
    return text.replace(old, new, 1)


# 1) Remove the last dead procedural skill renderer CSS from V146.
p = Path("css/42-v146-system-polish.css")
s = p.read_text()
start_marker = ".v143-skill-flight{offset-anchor:50% 50%;transform-origin:50% 50%;}"
end_marker = ".v146-area-impact{"
start = s.find(start_marker)
if start >= 0:
    end = s.find(end_marker, start)
    if end < 0:
        raise RuntimeError("V146 legacy VFX CSS end marker missing")
    s = s[:start] + s[end:]
elif any(token in s for token in ("v143-skill-flight", "v143-skill-field", "v143-hit-impact", "v146-flight-art")):
    raise RuntimeError("V146 legacy VFX CSS exists outside expected block")
p.write_text(s)


# 2) Migrate the V146 historical test from SVG/procedural choreography to raster ownership.
p = Path("tests/v146-system-polish.test.js")
s = p.read_text()
old_title = 'test("battle timing, dead-target filtering and named choreography are enforced",()=>{'
new_title = 'test("battle timing, dead-target filtering and raster-only choreography are enforced",()=>{'
start = s.find(old_title)
if start < 0:
    start = s.find(new_title)
end = s.find('\ntest("shop quantity calculates and disables against the live total"', start)
if start < 0 or end < 0:
    raise RuntimeError("V146 choreography test block missing")
new_block = r'''test("battle timing, dead-target filtering and raster-only choreography are enforced",()=>{
    assert.match(timing,/earliestAt:Math\.max\([\s\S]*boundaryGate\?boundaryGate\.deadline:0/);
    assert.match(animation,/function canReceive\(config,side,index\)/);
    assert.match(animation,/entity\.hp\)>0/);
    assert.match(animation,/dragonSlash:\{[\s\S]*dragon-slash-cast\.png/);
    assert.match(animation,/phoenixCry:\{[\s\S]*phoenix-cry-cast\.png/);
    assert.match(animation,/iceArrowRain:\{[\s\S]*frost-arrow-rain-vfx\.png/);
    assert.match(animation,/fireRocket:\{[\s\S]*fire-rocket-cast\.png/);
    assert.match(animation,/renderer:"dom-sprite"/);
    assert.doesNotMatch(animation,/<svg\b|v146-flight-art|v143-skill-flight|v143-skill-field|v143-hit-impact/);
    assert.doesNotMatch(css,/v146-flight-art|v143-skill-flight|v143-skill-field|v143-hit-impact/);
    assert.match(css,/background:transparent !important/);
    assert.match(css,/\.badge-normal[\s\S]*color:#fff !important/);
    assert.match(css,/@keyframes v146AreaImpact/);
    assert.match(css,/\.v146-status-popup/);
    assert.match(source,/rect\.top\+rect\.height\*\.86/);
    assert.match(source,/setTimeout\(\(\)=>popup\.remove\(\),1300\)/);
    assert.match(css,/animation:v146StatusPopup 1\.25s ease-out both/);
    assert.match(css,/10%,90%\{opacity:1/);
});
'''
s = s[:start] + new_block + s[end:]
p.write_text(s)


# 3) Preserve all V146 battle CSS except explicitly retired legacy VFX sources.
p = Path("tests/ui-typography-battle-preservation.test.js")
s = p.read_text()
earth_helper = '''function retireV143EarthShieldSelector(text){
    return normalize(text.replace(
        "#battlePage .v146-defeated .v141-effect,\\n#battlePage .v146-defeated .v143-earth-shield-effect{display:none !important;}",
        "#battlePage .v146-defeated .v141-effect{display:none !important;}"
    ));
}
'''
legacy_helper = r'''
function retireV146LegacySkillVfx(text){
    const start=text.indexOf(".v143-skill-flight{offset-anchor:50% 50%;transform-origin:50% 50%;}");
    if(start<0){ return normalize(text); }
    const end=text.indexOf(".v146-area-impact{",start);
    assert.ok(end>start,"retired V146 VFX block end missing");
    return normalize(text.slice(0,start)+text.slice(end));
}
'''
if "function retireV146LegacySkillVfx" not in s:
    if earth_helper not in s:
        raise RuntimeError("battle preservation Earth Shield helper missing")
    s = s.replace(earth_helper, earth_helper + legacy_helper, 1)
s = replace_once(
    s,
    'retireV143EarthShieldSelector(segment(current(file),start,end)),\n        retireV143EarthShieldSelector(segment(at(BASE,file),start,end)),',
    'retireV146LegacySkillVfx(retireV143EarthShieldSelector(segment(current(file),start,end))),\n        retireV146LegacySkillVfx(retireV143EarthShieldSelector(segment(at(BASE,file),start,end))),',
    "battle preservation comparator",
)
s = s.replace(
    "outside retired V143 Earth Shield selector`",
    "outside retired V143 Earth Shield selector and V146 legacy skill VFX block`",
    1,
)
s = s.replace("translateY(12px)", "translateY(16px)")
needle = 'assert.doesNotMatch(current("css/42-v146-system-polish.css"),/v143-earth-shield-effect/);'
extra = 'assert.doesNotMatch(current("css/42-v146-system-polish.css"),/v143-skill-flight|v143-skill-field|v143-hit-impact|v146-flight-art/);'
if extra not in s:
    if needle not in s:
        raise RuntimeError("battle preservation V146 assertion missing")
    s = s.replace(needle, needle + "\n" + extra, 1)
p.write_text(s)


# 4) Extend the permanent raster-only source guard to V146.
p = Path("tests/v174-raster-only-combat-vfx-owner.test.js")
s = p.read_text()
s = replace_once(
    s,
    'assert.doesNotMatch(css146,/v143-earth-shield-effect/);',
    'assert.doesNotMatch(css146,/v143-earth-shield-effect|v143-skill-flight|v143-skill-field|v143-hit-impact|v146-flight-art/);',
    "V174 V146 source guard",
)
p.write_text(s)

print("V146 dead VFX source cleanup staged.")
