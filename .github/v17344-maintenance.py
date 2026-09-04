from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def ensure_replace(text, old, new, label):
    old_count=text.count(old)
    new_count=text.count(new)
    if old_count==1:
        return text.replace(old,new,1)
    if old_count==0 and new_count>=1:
        return text
    raise SystemExit(f"{label}: unexpected state old={old_count}, new={new_count}")


# 1. V132 compatibility follows current one-character-Lv10 daily dungeon rule.
p="js/27-v132-content-expansion.js"
s=read(p)
s=ensure_replace(
    s,
    '    window.v132HasTwoCharactersAtLevel20=hasTwoCharactersAtLevel20;',
    '    window.v132HasLevel10CharacterForDailyDungeon=hasLevel10CharacterForDailyDungeon;\n'
    '    window.v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon;',
    "V132 daily compatibility export"
)
write(p,s)

# 2. Flood Beast keeps the formal Water Ball prerequisite; show that prerequisite on the lock button.
p="js/00-main.js"
s=read(p)
s=ensure_replace(
    s,
    '                "🔒 未解鎖"',
    '                "🔒 "+getSkillPrereqLabel(skill)',
    "skill prerequisite label"
)
write(p,s)

# 3. Main-city UHD asset filename/cache revision follows V173.44.
p="css/46-v154-dev-fixes.css"
s=read(p)
s=ensure_replace(s,'home-background-v17343.png','home-background-v17344.png',"main-city UHD CSS path")
write(p,s)

# 4. Historical player-flow regression aligns with current intended behavior.
p="tests/v173.42-player-flow.test.js"
s=read(p)
s=s.replace(
    '/* Second / third character catch-up is EXP-only after the Lv10 fast start and ends at Lv20. */',
    '/* Second / third character starts at Lv1; catch-up is EXP-only and ends at Lv20. */'
)
s=ensure_replace(
    s,
    'assert.match(economy,/function grantFastStartToAdditionalCharacter\\(character,slotNumber\\)/);\n'
    'assert.match(economy,/character\\.level=10/);',
    'assert.doesNotMatch(economy,/function grantFastStartToAdditionalCharacter\\(character,slotNumber\\)/);\n'
    'assert.doesNotMatch(economy,/啟用追趕養成，從 Lv\\.10 開始冒險/);',
    "additional-character regression"
)
s=ensure_replace(
    s,
    'assert.match(dungeonPolish,/v173GrantCharacterCatchUpExp/);',
    'assert.match(dungeonPolish,/function finishDailyExpReward\\(amount\\)[\\s\\S]*?sharedExp=Math\\.max\\(0,numeric\\(sharedExp\\)\\+granted\\)/);\n'
    'assert.doesNotMatch(dungeonPolish,/請指定1名角色領取/);',
    "daily EXP shared-pool regression"
)
s=s.replace('home-background-v17343\\.png','home-background-v17344\\.png')
s=s.replace('"assets/ui/home-background-v17343.png"','"assets/ui/home-background-v17344.png"')
write(p,s)

# 5. V170 is a historical integration test. Validate the current Gold flow instead of a removed runtime helper API.
p="tests/v170-final-spec-integration.test.js"
s=read(p)
s=ensure_replace(
    s,
    'return {runs:runs,one40:one40,two40:two40,three80:three80,goldReward:v148GetGoldDungeonReward(40)};',
    'return {runs:runs,one40:one40,two40:two40,three80:three80};',
    "V170 removed Gold helper call"
)
s=ensure_replace(
    s,
    '    assert.ok(result.goldReward>0);\n'
    '    const dungeonSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");',
    '    const dungeonSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");\n'
    '    assert.match(dungeonSource,/function goldDungeonReward\\(level\\)/);\n'
    '    assert.match(dungeonSource,/showDailyGoldReward\\(goldDungeonReward\\(active\\.level\\)\\)/);',
    "V170 current Gold source checks"
)
write(p,s)

# 6. Current-request regression covers all maintenance guarantees.
p="tests/v173.44-current-request.test.js"
s=read(p)
anchor='const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");'
imports=(anchor+'\n'
    'const economy=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");\n'
    'const main=fs.readFileSync("js/00-main.js","utf8");\n'
    'const water=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");\n'
    'const v132=fs.readFileSync("js/27-v132-content-expansion.js","utf8");\n'
    'const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");\n'
    'const index=fs.readFileSync("index.html","utf8");')
s=ensure_replace(s,anchor,imports,"current-request imports")
s=ensure_replace(
    s,
    'assert.match(battle,/material:\\{title:"材料副本",requirement:"任一角色達到20級"/);',
    'assert.match(battle,/material:\\{title:"材料副本",requirement:"任一角色達到10級"/);',
    "material Lv10 regression"
)
s=ensure_replace(
    s,
    'assert.match(battle,/gold:\\{title:"金幣副本",requirement:"任一角色達到20級"/);',
    'assert.match(battle,/gold:\\{title:"金幣副本",requirement:"任一角色達到10級"/);',
    "gold Lv10 regression"
)
marker='console.log("✓ V173.44 current request regression passed");'
checks=r'''
assert.match(battle,/exp:\{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP"/);
assert.match(battle,/function hasLevel10Character\(\)/);
assert.doesNotMatch(battle,/hasLevel20Character/);
assert.match(battle,/function finishDailyExpReward\(amount\)[\s\S]*?sharedExp=Math\.max\(0,numeric\(sharedExp\)\+granted\)/);
assert.doesNotMatch(battle,/請指定1名角色領取/);
assert.doesNotMatch(economy,/grantFastStartToAdditionalCharacter/);
assert.match(main,/function buildAdditionalCharacter[\s\S]*?level:1,[\s\S]*?exp:0,/);
assert.match(v132,/v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon/);
assert.match(main,/"🔒 "\+getSkillPrereqLabel\(skill\)/);
assert.match(water,/floodBeast:\{[\s\S]*?learnCost:15[\s\S]*?requires:\["waterBall"\]/);
assert.match(main,/function learnSkill\(skillId\)[\s\S]*?isSkillPrereqMet\([\s\S]*?character\.skillLevels,[\s\S]*?skill[\s\S]*?availablePoints<learnCost[\s\S]*?owner\.skillPoints=availablePoints-learnCost/);
assert.match(water,/applyFinalSkillData\(\);[\s\S]*?renderSkillLoadout\(\)/);
assert.match(abyssCss,/home-background-v17344\.png/);
assert.equal(fs.existsSync("assets/ui/home-background-v17344.png"),true,"assets/ui/home-background-v17344.png");
assert.match(loader,/const V_ASSET_VERSION="173\.44"/);
assert.match(index,/id="homeVersionBadge"[\s\S]*?aria-label="目前版本 V173\.44"[\s\S]*?>V173\.44<\/div>/);
'''
if checks.strip() not in s:
    if marker not in s:
        raise SystemExit("current-request tail marker missing")
    s=s.replace(marker,checks+'\n'+marker,1)
write(p,s)

# 7. Record the completed maintenance and permanent DEV publishing route.
p="HANDOFF.md"
s=read(p)
section='''\n## V173.44 維修收斂（目前 dev）\n- 三個正式日常副本統一為任一角色 Lv10 可進；經驗副本獎勵直接進共用經驗池，不再指定角色。\n- 第二／第三角色新建時固定從 Lv1 開始；Lv20 前只保留既有 EXP 追趕倍率，不再強制跳到 Lv10。\n- 水元素【洪水猛獸】維持正式規格：需先學水球術、初學 15 技能點；學習流程讀取目前選中角色的實際 skillPoints，鎖定按鈕直接顯示缺少的前置技能。\n- 主城 HUD、index 載入版本與 V_ASSET_VERSION 已同步 V173.44；主城 UHD 背景使用 home-background-v17344.png。\n- dev 預覽固定由 Cloudflare Pages 自動發布：`https://four-symbols-dev.pages.dev`；不再使用 GitHack／RawCDN 作為測試站。\n- 僅修改 dev，main 不動。\n'''
if '## V173.44 維修收斂（目前 dev）' not in s:
    s=section+s
write(p,s)
