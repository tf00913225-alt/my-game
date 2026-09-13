from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    if old in s:
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8")


replace(
    "tests/boss-mechanism-vfx-card-ui-20260909.test.js",
    "// The function/mechanism card is the paired 9:16 battlefield component. Its",
    "// The function/mechanism card is the paired 4:3 battlefield component. Its",
)
replace(
    "tests/boss-mechanism-vfx-card-ui-20260909.test.js",
    "aspect-ratio:9 \\/ 16;[\\s\\S]*?flex:0 0 var\\(--gameplay-mechanism-card-width\\);",
    "aspect-ratio:4 \\/ 3;[\\s\\S]*?flex:0 0 var\\(--gameplay-mechanism-card-width\\);",
)

replace(
    "tests/ui-typography-battle-preservation.test.js",
    "// redundant title is removed, both BOSS and mechanism target cards use 9:16,",
    "// redundant title is removed, the BOSS target stays 9:16 while the mechanism target uses 4:3,",
)
replace(
    "tests/ui-typography-battle-preservation.test.js",
    "assert.match(now,/\\.boss-mechanism-card\\{[\\s\\S]*?width:var\\(--gameplay-mechanism-card-width\\);[\\s\\S]*?min-width:0;[\\s\\S]*?aspect-ratio:9 \\/ 16;",
    "assert.match(now,/\\.boss-mechanism-card\\{[\\s\\S]*?width:var\\(--gameplay-mechanism-card-width\\);[\\s\\S]*?min-width:0;[\\s\\S]*?aspect-ratio:4 \\/ 3;",
)
replace(
    "tests/ui-typography-battle-preservation.test.js",
    '"Gameplay BOSS 9:16 sizing must stay specificity-driven"',
    '"Gameplay BOSS/mechanism sizing must stay specificity-driven"',
)
replace(
    "tests/ui-typography-battle-preservation.test.js",
    "approved non-overlapping 16:9 activity-cover stack",
    "approved non-overlapping 16:9 activity-cover stack and 4:3 mechanism target",
)

p = Path("tests/boss-mobile-portrait-browser.test.js")
s = p.read_text(encoding="utf-8")
s = s.replace("const ratio=16/9;", "const bossRatio=16/9;\n    const mechanismRatio=3/4;")
s = s.replace("Math.abs(data.bossRatio-ratio)<.025", "Math.abs(data.bossRatio-bossRatio)<.025")
s = s.replace("Math.abs(data.mechanismRatio-ratio)<.025", "Math.abs(data.mechanismRatio-mechanismRatio)<.025")
s = s.replace("`Mechanism card is not 9:16 at ${width}x${height}: ${data.mechanismRatio}`", "`Mechanism card is not 4:3 at ${width}x${height}: ${data.mechanismRatio}`")
s = s.replace('assert.equal(data.mechanismComputed.aspectRatio,"9 / 16");', 'assert.equal(data.mechanismComputed.aspectRatio,"4 / 3");')
s = s.replace("`Mechanism content overflows its 9:16 card at ${width}x${height}`", "`Mechanism content overflows its 4:3 card at ${width}x${height}`")
p.write_text(s, encoding="utf-8")

p = Path("tests/ui-typography-standard.test.js")
s = p.read_text(encoding="utf-8")ns = s.replace("const homePolish = read(owners.homePolish);", "const homePolish = read(owners.homePolish);\nconst homeRoster = read('css/19-stage-v54-main-city-moderate-native-scale.css');")
s = s.replace("assert.match(homePolish, /\\.v146-home-roster > header\\{[^}]*font-size:15px/);", "assert.match(homeRoster, /\\.v146-home-roster > header\\{[^}]*font-size:15px/);")
s = s.replace("assert.match(homePolish, /\\.v146-home-character-main > div:first-child\\{[^}]*font-size:15px/);", "assert.match(homeRoster, /\\.v146-home-character-main > div:first-child\\{[^}]*font-size:15px/);")
s = s.replace("assert.match(homePolish, /\\.v146-home-resource strong\\{[^}]*font-size:13px/);", "assert.match(homeRoster, /\\.v146-home-resource strong\\{[^}]*font-size:13px/);")
p.write_text(s, encoding="utf-8")

replace(
    "tests/v174-current-ui-fixes.test.js",
    'const rosterCss=read("css/42-v146-system-polish.css");',
    'const rosterCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");',
)
replace(
    "tests/v173.39-main-city-final-polish.test.js",
    'roster=read("css/42-v146-system-polish.css"),runtime=read("js/41-v146-system-polish.js")',
    'roster=read("css/19-stage-v54-main-city-moderate-native-scale.css"),runtime=read("js/16-stage-v54-main-city-runtime.js")',
)

p = Path("tests/v173.28-main-city-lobby.test.js")
s = p.read_text(encoding="utf-8")
s = s.replace('const rosterCss=read("css/42-v146-system-polish.css");', 'const rosterCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");')
s = s.replace('const rosterRuntime=read("js/41-v146-system-polish.js");', 'const rosterRuntime=read("js/16-stage-v54-main-city-runtime.js");')
s = s.replace("function numeric\\(value\\)", "function rosterNumber\\(value\\)")
s = s.replace("function formatHomeResourceValue\\(value\\)", "function rosterResourceText\\(value\\)")
s = s.replace("formatHomeResourceValue(12485243),formatHomeResourceValue(104852430),formatHomeResourceValue(1248524300)", "rosterResourceText(12485243),rosterResourceText(104852430),rosterResourceText(1248524300)")
s = s.replace('syncHomeResourceValue\\(hudGold,[^\\n]+\\);[\\s\\S]*syncHomeResourceValue\\(hudExp,[^\\n]+\\);', 'syncRosterResource\\(document.getElementById\\("homeHudGoldValue"\\),[^\\n]+\\);[\\s\\S]*syncRosterResource\\(document.getElementById\\("homeHudExpValue"\\),[^\\n]+\\);')
p.write_text(s, encoding="utf-8")

p = Path("tests/v146-system-polish.test.js")
s = p.read_text(encoding="utf-8")
s = s.replace('const source=fs.readFileSync("js/41-v146-system-polish.js","utf8");', 'const source=fs.readFileSync("js/41-v146-system-polish.js","utf8");\nconst eagerSource=fs.readFileSync("js/16-stage-v54-main-city-runtime.js","utf8");')
s = s.replace("assert.match(source,/v146-home-roster/);", "assert.match(eagerSource,/v146-home-roster/);")
p.write_text(s, encoding="utf-8")

# V173.43 keeps its growth/red-dot rules in V146 CSS, but the main-city roster
# geometry moved to the eager app-shell owner so it is ready before game entry.
p = Path("tests/v173.43-growth-charge.test.js")
s = p.read_text(encoding="utf-8")
s = s.replace('const polishCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");', 'const polishCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");\nconst homeRosterCss=fs.readFileSync("css/19-stage-v54-main-city-moderate-native-scale.css","utf8");')
s = s.replace('test("three-character home HUD grows with readable text but remains three columns",()=>{assert.match(polishCss,/grid-template-columns:repeat\\(3,minmax\\(0,1fr\\)\\)/);', 'test("three-character home HUD grows with readable text but remains three columns",()=>{assert.match(homeRosterCss,/grid-template-columns:repeat\\(3,minmax\\(0,1fr\\)\\)/);')
s = s.replace('assert.match(polishCss,/grid-template-columns:40px minmax\\(0,1fr\\)/);assert.match(polishCss,/min-height:84px/);assert.match(polishCss,/width:40', 'assert.match(homeRosterCss,/grid-template-columns:40px minmax\\(0,1fr\\)/);assert.match(homeRosterCss,/min-height:84px/);assert.match(homeRosterCss,/width:40')
p.write_text(s, encoding="utf-8")

print("Aligned V173.65 intentional regression owners.")
