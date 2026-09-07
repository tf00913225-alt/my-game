from pathlib import Path

p = Path("tests/v142-skill-animation.test.js")
s = p.read_text(encoding="utf-8")

old_behavior = '''    await test("player and monster skill badges actually start animation gates",()=>{\n        const {context}=createContext();\n        context.showSkillNameBadge("火焰斬","fire",0);\n        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");\n        assert.equal(context.v142GetAnimationDiagnostics().last.side,"player");\n        context.showMonsterSkillNameBadge("火焰斬","fire",0);\n        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");\n        assert.equal(context.v142GetAnimationDiagnostics().last.side,"monster");\n    });'''
new_behavior = '''    await test("player and monster direct badge triggers actually start animation gates",()=>{\n        const {context}=createContext();\n        context.v142PlaySkillAnimationFromBadge("player","火焰斬","fire",0);\n        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");\n        assert.equal(context.v142GetAnimationDiagnostics().last.side,"player");\n        context.v142PlaySkillAnimationFromBadge("monster","火焰斬","fire",0);\n        assert.equal(context.v142SkillAnimationDirector.getLatest().config.name,"火焰斬");\n        assert.equal(context.v142GetAnimationDiagnostics().last.side,"monster");\n    });'''

old_owner = '''    await test("player and monster badge hooks share one director and cleanup path",()=>{\n        assert.match(source,/showSkillNameBadge=function/);\n        assert.match(source,/showMonsterSkillNameBadge=function/);'''
new_owner = '''    await test("direct badge action trigger shares one director and cleanup path",()=>{\n        assert.match(source,/window\\.v142PlaySkillAnimationFromBadge=function/);\n        assert.doesNotMatch(source,/const previous=showSkillNameBadge/);'''

for label, old, new in [
    ("behavior test", old_behavior, new_behavior),
    ("owner test", old_owner, new_owner),
]:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")
print("aligned V142 tests with direct trigger ownership")
