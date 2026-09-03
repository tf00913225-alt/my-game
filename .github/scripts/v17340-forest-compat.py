from pathlib import Path


def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)

p=Path('js/00-main.js')
s=p.read_text()
helper='''function makeBeginnerForestMonster(name,level,element){\n    const monster=makeZoneMonster(name,level,element);\n    monster.agilityPoints=0;\n    monster.agility=0;\n    monster.v173BeginnerForest=true;\n    return monster;\n}\n\n'''
s=once(s,helper,'','remove temporary forest constructor')
if s.count('makeBeginnerForestMonster(')!=6:
    raise SystemExit('expected six beginner forest constructor calls')
s=s.replace('makeBeginnerForestMonster(','makeZoneMonster(')
anchor='''    makeZoneMonster("史萊姆",2,"water")\n\n];\n\n\n/*\n   ★ 荒漠地帶'''
replacement='''    makeZoneMonster("史萊姆",2,"water")\n\n];\n\nforestMonsters.forEach(monster=>{\n    monster.agilityPoints=0;\n    monster.agility=0;\n    monster.v173BeginnerForest=true;\n});\n\n\n/*\n   ★ 荒漠地帶'''
s=once(s,anchor,replacement,'forest post configuration')
p.write_text(s)

p=Path('tests/v173.40-beginner-balance.test.js')
t=p.read_text()
old='''test("newbie forest owns zero agility monsters",()=>{\n    assert.match(main,/function makeBeginnerForestMonster\\(name,level,element\\)[\\s\\S]*?monster\\.agilityPoints=0;[\\s\\S]*?monster\\.agility=0;[\\s\\S]*?monster\\.v173BeginnerForest=true;/);\n    assert.equal((main.match(/makeBeginnerForestMonster\\(\\"(?:哥布林|史萊姆)\\"/g)||[]).length,6);\n});'''
new='''test("newbie forest owns zero agility monsters while preserving the six canonical monster rows",()=>{\n    const forest=(main.match(/const forestMonsters = \\[[\\s\\S]*?\\n\\];/)||[])[0]||"";\n    assert.equal((forest.match(/makeZoneMonster\\(\\"(?:哥布林|史萊姆)\\"/g)||[]).length,6);\n    assert.match(main,/forestMonsters\\.forEach\\(monster=>\\{[\\s\\S]*?monster\\.agilityPoints=0;[\\s\\S]*?monster\\.agility=0;[\\s\\S]*?monster\\.v173BeginnerForest=true;/);\n});'''
t=once(t,old,new,'focused forest test')
p.write_text(t)
print('forest roster compatibility preserved')
