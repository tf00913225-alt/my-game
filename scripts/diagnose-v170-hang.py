from pathlib import Path

SOURCE = Path("tests/v170-final-spec-integration.test.js")
OUT = Path(".diagnostic")
TARGET = "same-name states miss without refresh while differently named hard controls coexist"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def add_owner(text):
    old = 'const EXPECTED_RUNTIME_PATHS=[\n    "js/25-v131-fix-batch.js",'
    new = 'const EXPECTED_RUNTIME_PATHS=[\n    "js/battlefield-slot-owner.js",\n    "js/25-v131-fix-batch.js",'
    return replace_once(text, old, new, "runtime path anchor")


def add_start_pass(text, only_target=False):
    old = '''let passed=0;\nfunction test(name,handler){\n    handler();\n    passed++;\n    console.log("✓ "+name);\n}\n'''
    if only_target:
        new = f'''let passed=0;\nfunction test(name,handler){{\n    if(name!=={TARGET!r}){{ return; }}\n    console.log("START "+name);\n    handler();\n    passed++;\n    console.log("PASS "+name);\n}}\n'''
    else:
        new = '''let passed=0;\nfunction test(name,handler){\n    console.log("START "+name);\n    handler();\n    passed++;\n    console.log("PASS "+name);\n}\n'''
    return replace_once(text, old, new, "test helper")


def add_markers(text):
    text = replace_once(
        text,
        '        const target={name:"狀態目標",hp:100,maxHP:100,alive:true,statusEffects:[]};\n',
        '        const target={name:"狀態目標",hp:100,maxHP:100,alive:true,statusEffects:[]};\n        console.log("MARK 1 target created");\n',
        "MARK 1",
    )
    text = replace_once(
        text,
        '        applyBurnEffect(target,2,3);\n        applyBurnEffect(target,2,8);\n',
        '        applyBurnEffect(target,2,3);\n        console.log("MARK 2 first burn returned");\n        applyBurnEffect(target,2,8);\n        console.log("MARK 3 second burn returned");\n',
        "MARK 2/3",
    )
    text = replace_once(
        text,
        '        applyFreezeEffect(target,5);\n        applyMonsterDebuff(target,"petrify",3,0);\n',
        '        applyFreezeEffect(target,5);\n        console.log("MARK 4 first freeze returned");\n        applyMonsterDebuff(target,"petrify",3,0);\n        console.log("MARK 5 petrify returned");\n',
        "MARK 4/5",
    )
    text = replace_once(
        text,
        '        const afterPetrify=target.statusEffects.map(effect=>effect.type);\n        applyFreezeEffect(target,5);\n        const afterFreeze=target.statusEffects.map(effect=>effect.type);\n',
        '        const afterPetrify=target.statusEffects.map(effect=>effect.type);\n        applyFreezeEffect(target,5);\n        console.log("MARK 6 second freeze returned");\n        const afterFreeze=target.statusEffects.map(effect=>effect.type);\n',
        "MARK 6",
    )
    text = replace_once(
        text,
        '        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n',
        '        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        console.log("MARK 7 final abyss monster created");\n        Math.random=function(){ return 0; };\n        console.log("MARK 8 before v141TryMonsterSpecialAction");\n        const action=v141TryMonsterSpecialAction(0);\n        console.log("MARK 9 v141TryMonsterSpecialAction returned");\n',
        "MARK 7/8/9",
    )
    return text


def write(name, text):
    OUT.mkdir(exist_ok=True)
    path = OUT / name
    path.write_text(text)
    print(path)


base = SOURCE.read_text()
write("v170-owner-startpass.test.js", add_start_pass(add_owner(base), only_target=False))
write("v170-owner-marked.test.js", add_markers(add_start_pass(add_owner(base), only_target=True)))
write("v170-no-owner-marked.test.js", add_markers(add_start_pass(base, only_target=True)))
