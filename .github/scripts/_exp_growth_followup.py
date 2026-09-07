from pathlib import Path

# Update the historical source-regex so it verifies the converged Element Box
# owner while preserving the required else-if exclusion from rested EXP.
path=Path("tests/v139-economy-rested-exp.test.js")
text=path.read_text(encoding="utf-8")
old=r'''/if\(isElementBoxBattle\)\{[\s\S]*?finalExp=Math\.round\(finalExp\*ELEMENT_BOX_EXP_RATIO\);[\s\S]*?\}else if\(typeof window\.v139TryConsumeRestedBattle==="function"\)/'''
new=r'''/if\(isElementBoxBattle\)\{[\s\S]*?finalExp=applyPatrolExpMode\(finalExp,\{elementBox:true\}\);[\s\S]*?\}else if\(typeof window\.v139TryConsumeRestedBattle==="function"\)/'''
if text.count(old)!=1:
    raise SystemExit(f"expected one element-box/rested source assertion, got {text.count(old)}")
path.write_text(text.replace(old,new,1),encoding="utf-8")

# Daily Growth is an integer reward owner: round(expNext * levelsPerDay).
# Verify that exact runtime formula instead of comparing a rounded integer ratio
# to the floating target with an unrealistically tiny epsilon.
path=Path("tests/v170-final-spec-integration.test.js")
text=path.read_text(encoding="utf-8")
old='''        const daily=[20,50,99].map(level=>{\n            const reward=v173GetDailyGrowthRewardBreakdown(level);\n            return [level,reward.totalExp/v133GetExpNextForLevel(level),v173GetDailyQuestLevelsPerDay(level)];\n        });'''
new='''        const daily=[20,50,99].map(level=>{\n            const reward=v173GetDailyGrowthRewardBreakdown(level);\n            const levelsPerDay=v173GetDailyQuestLevelsPerDay(level);\n            return [level,reward.totalExp,Math.round(v133GetExpNextForLevel(level)*levelsPerDay),levelsPerDay];\n        });'''
if text.count(old)!=1:
    raise SystemExit(f"expected one daily Growth report block, got {text.count(old)}")
text=text.replace(old,new,1)
old_assert='''    report.daily.forEach(([level,actual,expected])=>assert.ok(Math.abs(actual-expected)<.000001,"Lv"+level+" daily growth ratio"));'''
new_assert='''    report.daily.forEach(([level,actual,expected])=>assert.equal(actual,expected,"Lv"+level+" daily Growth EXP"));'''
if text.count(old_assert)!=1:
    raise SystemExit(f"expected one daily Growth assertion, got {text.count(old_assert)}")
path.write_text(text.replace(old_assert,new_assert,1),encoding="utf-8")

print("EXP follow-up regressions updated")
