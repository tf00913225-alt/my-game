from pathlib import Path

V170 = Path("tests/v170-final-spec-integration.test.js")
V155 = Path("js/46-v155-dev-fixes.js")
OUT = Path(".diagnostic")
TARGET = "same-name states miss without refresh while differently named hard controls coexist"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def instrument_v155(source):
    text = source

    text = replace_once(
        text,
        '    function applyEvasionBlessing(monster,bonusPercent,duration){\n        if(!monster||monster.alive===false){ return false; }\n',
        '    function applyEvasionBlessing(monster,bonusPercent,duration){\n'
        '        console.log("BLESS 1 enter");\n'
        '        if(!monster||monster.alive===false){ console.log("BLESS 13 return invalid"); return false; }\n',
        "BLESS enter",
    )
    text = replace_once(
        text,
        '        const existing=monster.v155EvasionBlessing;\n        if(\n',
        '        const existing=monster.v155EvasionBlessing;\n'
        '        console.log("BLESS 2 before existing-state check");\n'
        '        if(\n',
        "BLESS existing check",
    )
    text = replace_once(
        text,
        '            if(typeof window.v173CanApplyNamedPersistentState==="function"){\n                window.v173CanApplyNamedPersistentState(\n',
        '            if(typeof window.v173CanApplyNamedPersistentState==="function"){\n'
        '                console.log("BLESS 3 before v173CanApplyNamedPersistentState");\n'
        '                window.v173CanApplyNamedPersistentState(\n',
        "BLESS gate before",
    )
    text = replace_once(
        text,
        '                    "元祖賜福"\n                );\n            }\n            return false;\n        }\n        clearOldAgilityBlessing(monster);\n',
        '                    "元祖賜福"\n'
        '                );\n'
        '                console.log("BLESS 4 after v173CanApplyNamedPersistentState");\n'
        '            }else{\n'
        '                console.log("BLESS 3/4 v173CanApplyNamedPersistentState skipped");\n'
        '            }\n'
        '            console.log("BLESS 13 return duplicate");\n'
        '            return false;\n'
        '        }\n'
        '        console.log("BLESS 3/4 v173CanApplyNamedPersistentState not needed");\n'
        '        console.log("BLESS 5 before clearOldAgilityBlessing");\n'
        '        clearOldAgilityBlessing(monster);\n'
        '        console.log("BLESS 6 after clearOldAgilityBlessing");\n',
        "BLESS duplicate return and clear",
    )
    text = replace_once(
        text,
        '        const display={\n            type:"v141TeamBuff",v141BuffType:"dodge",statusName:"元祖賜福",turnsLeft:turns\n        };\n        const blessing={\n',
        '        const display={\n'
        '            type:"v141TeamBuff",v141BuffType:"dodge",statusName:"元祖賜福",turnsLeft:turns\n'
        '        };\n'
        '        console.log("BLESS 7 before ensureV155EvasionBase");\n'
        '        const blessing={\n',
        "BLESS ensure before",
    )
    text = replace_once(
        text,
        '            battleToken:currentBattleToken(),expiresTurn:currentRound()+turns\n        };\n        monster.v155EvasionBlessing=blessing;\n',
        '            battleToken:currentBattleToken(),expiresTurn:currentRound()+turns\n'
        '        };\n'
        '        console.log("BLESS 8 after ensureV155EvasionBase");\n'
        '        monster.v155EvasionBlessing=blessing;\n',
        "BLESS ensure after",
    )
    text = replace_once(
        text,
        '        monster.activeBuffs.push(display);\n        recomputeV155Evasion(monster);\n        if(typeof window.v173MarkPersistentStateName==="function"){\n',
        '        monster.activeBuffs.push(display);\n'
        '        console.log("BLESS 9 before recomputeV155Evasion");\n'
        '        recomputeV155Evasion(monster);\n'
        '        console.log("BLESS 10 after recomputeV155Evasion");\n'
        '        console.log("BLESS 11 before v173MarkPersistentStateName");\n'
        '        if(typeof window.v173MarkPersistentStateName==="function"){\n',
        "BLESS recompute/mark before",
    )
    text = replace_once(
        text,
        '            window.v173MarkPersistentStateName(display,"元祖賜福");\n        }\n        return true;\n    }\n\n    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){\n',
        '            window.v173MarkPersistentStateName(display,"元祖賜福");\n'
        '        }\n'
        '        console.log("BLESS 12 after v173MarkPersistentStateName");\n'
        '        console.log("BLESS 13 return");\n'
        '        return true;\n'
        '    }\n\n'
        '    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){\n'
        '        console.log("EXTREME 1 enter");\n',
        "BLESS return + EXTREME enter",
    )

    text = replace_once(
        text,
        '        monster.v141AbyssAi="v155-support";\n        const allies=currentAbyssEntries();\n        if(!allies.length){ return false; }\n',
        '        monster.v141AbyssAi="v155-support";\n'
        '        console.log("EXTREME 2 currentAbyssEntries before");\n'
        '        const allies=currentAbyssEntries();\n'
        '        console.log("EXTREME 3 currentAbyssEntries after allies.length="+allies.length+" indexes="+JSON.stringify(allies.map(entry=>entry.index)));\n'
        '        if(!allies.length){ return false; }\n',
        "EXTREME currentAbyssEntries",
    )
    text = replace_once(
        text,
        '        const needsBlessing=allies.some(entry=>!(entry.monster.v155EvasionBlessing&&\n            entry.monster.v155EvasionBlessing.battleToken===currentBattleToken()&&\n            currentRound()<numeric(entry.monster.v155EvasionBlessing.expiresTurn)));\n        const skillId=forcedSkillId||((hasNegative||needsHeal||needsBlessing)?"yuanZuBlessing":null);\n',
        '        const needsBlessing=allies.some(entry=>!(entry.monster.v155EvasionBlessing&&\n'
        '            entry.monster.v155EvasionBlessing.battleToken===currentBattleToken()&&\n'
        '            currentRound()<numeric(entry.monster.v155EvasionBlessing.expiresTurn)));\n'
        '        console.log("EXTREME 4 condition scan done hasNegative="+hasNegative+" needsHeal="+needsHeal+" needsBlessing="+needsBlessing);\n'
        '        const skillId=forcedSkillId||((hasNegative||needsHeal||needsBlessing)?"yuanZuBlessing":null);\n',
        "EXTREME condition scan",
    )
    text = replace_once(
        text,
        '        if(skillId!=="yuanZuBlessing"||!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }\n\n        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));\n',
        '        if(skillId!=="yuanZuBlessing"||!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }\n'
        '        console.log("EXTREME 5 skill resolved skillId="+skillId);\n\n'
        '        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));\n',
        "EXTREME skill resolved",
    )
    text = replace_once(
        text,
        '            let healedTotal=0;\n            let restoredSpTotal=0;\n            allies.forEach((entry,index)=>{\n                const ally=entry.monster;\n                if(applyEvasionBlessing(ally,skill.evasionBonusPercent,skill.duration)){ blessedTargets++; }\n                const healed=restoreMonsterHp(ally,skill.baseHeal);\n                const restored=restoreMonsterSp(ally,skill.baseHealSP);\n                healedTotal+=healed;\n                restoredSpTotal+=restored;\n                const cleansed=forcedCleanse===undefined\n',
        '            let healedTotal=0;\n'
        '            let restoredSpTotal=0;\n'
        '            console.log("EXTREME 6 before allies.forEach");\n'
        '            allies.forEach((entry,index)=>{\n'
        '                const ally=entry.monster;\n'
        '                console.log("ALLY "+index+" A begin entry.index="+entry.index);\n'
        '                console.log("ALLY "+index+" B before applyEvasionBlessing");\n'
        '                if(applyEvasionBlessing(ally,skill.evasionBonusPercent,skill.duration)){ blessedTargets++; }\n'
        '                console.log("ALLY "+index+" C after applyEvasionBlessing");\n'
        '                console.log("ALLY "+index+" D before restoreMonsterHp");\n'
        '                const healed=restoreMonsterHp(ally,skill.baseHeal);\n'
        '                console.log("ALLY "+index+" E after restoreMonsterHp healed="+healed);\n'
        '                console.log("ALLY "+index+" F before restoreMonsterSp");\n'
        '                const restored=restoreMonsterSp(ally,skill.baseHealSP);\n'
        '                console.log("ALLY "+index+" G after restoreMonsterSp restored="+restored);\n'
        '                healedTotal+=healed;\n'
        '                restoredSpTotal+=restored;\n'
        '                console.log("ALLY "+index+" H before cleanse roll");\n'
        '                const cleansed=forcedCleanse===undefined\n',
        "ALLY A-H",
    )
    text = replace_once(
        text,
        '                    :Array.isArray(forcedCleanse)\n                    ?!!forcedCleanse[index]\n                    :!!forcedCleanse;\n                if(cleansed&&Array.isArray(ally.statusEffects)){\n',
        '                    :Array.isArray(forcedCleanse)\n'
        '                    ?!!forcedCleanse[index]\n'
        '                    :!!forcedCleanse;\n'
        '                console.log("ALLY "+index+" I after cleanse roll cleansed="+cleansed);\n'
        '                if(cleansed&&Array.isArray(ally.statusEffects)){\n',
        "ALLY cleanse after",
    )
    text = replace_once(
        text,
        '                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }\n                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){\n',
        '                console.log("ALLY "+index+" J before showMonsterHit condition="+(healed>0&&typeof showMonsterHit==="function"));\n'
        '                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }\n'
        '                console.log("ALLY "+index+" K after showMonsterHit");\n'
        '                console.log("ALLY "+index+" L before showDamagePopup condition="+(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"));\n'
        '                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){\n',
        "ALLY show hit/damage before",
    )
    text = replace_once(
        text,
        '                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }\n                }\n                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }\n            });\n            if(typeof addBattleLog==="function"){\n',
        '                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }\n'
        '                }\n'
        '                console.log("ALLY "+index+" M after showDamagePopup");\n'
        '                console.log("ALLY "+index+" N before v141PlayCardEffect condition="+(typeof window.v141PlayCardEffect==="function"));\n'
        '                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }\n'
        '                console.log("ALLY "+index+" O after v141PlayCardEffect");\n'
        '                console.log("ALLY "+index+" P end");\n'
        '            });\n'
        '            console.log("EXTREME 7 allies complete");\n'
        '            console.log("EXTREME 8 before addBattleLog condition="+(typeof addBattleLog==="function"));\n'
        '            if(typeof addBattleLog==="function"){\n',
        "ALLY damage/card + EXTREME 7/8",
    )
    text = replace_once(
        text,
        '                    cleansedTargets+"名目標觸發35%獨立淨化，共解除"+removed+"個負面狀態。");\n            }\n        }else{ return false; }\n        if(typeof updateUI==="function"){ updateUI(); }\n        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }\n        return true;\n',
        '                    cleansedTargets+"名目標觸發35%獨立淨化，共解除"+removed+"個負面狀態。");\n'
        '            }\n'
        '            console.log("EXTREME 9 after addBattleLog");\n'
        '        }else{ return false; }\n'
        '        console.log("EXTREME 10 before updateUI condition="+(typeof updateUI==="function"));\n'
        '        if(typeof updateUI==="function"){ updateUI(); }\n'
        '        console.log("EXTREME 11 after updateUI");\n'
        '        console.log("EXTREME 12 before finishPlayerAction condition="+(typeof finishPlayerAction==="function"));\n'
        '        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }\n'
        '        console.log("EXTREME 13 after finishPlayerAction");\n'
        '        console.log("EXTREME 14 return true");\n'
        '        return true;\n',
        "EXTREME tail",
    )
    return text


def add_owner_path(text):
    return replace_once(
        text,
        'const EXPECTED_RUNTIME_PATHS=[\n    "js/25-v131-fix-batch.js",',
        'const EXPECTED_RUNTIME_PATHS=[\n    "js/battlefield-slot-owner.js",\n    "js/25-v131-fix-batch.js",',
        "owner runtime path",
    )


def target_only(text, case_name):
    old = '''let passed=0;\nfunction test(name,handler){\n    handler();\n    passed++;\n    console.log("✓ "+name);\n}\n'''
    new = f'''let passed=0;\nfunction test(name,handler){{\n    if(name!=={TARGET!r}){{ return; }}\n    console.log("CASE {case_name} TEST START "+name);\n    handler();\n    passed++;\n    console.log("CASE {case_name} TEST PASS "+name);\n}}\n'''
    return replace_once(text, old, new, f"test helper {case_name}")


def state_setup(case_name):
    common = f'''        const owner=FourSymbolsBattlefieldSlots;\n'''
    if case_name == "A":
        mutation = '''        // CASE A: preserve the legacy V170 mutation and do not synchronize owner state.\n'''
    elif case_name == "B":
        mutation = '''        // CASE B: synchronize a formal one-monster snapshot through the real owner API.\n        const formalSnapshot=owner.createEnemyFormationSnapshot([0],{\n            originalFormationType:1,\n            rankWeight:function(monsterIndex){\n                const candidate=monsters[monsterIndex];\n                const rank=getMonsterRank(candidate);\n                if(rank==="boss"){ return 3; }\n                if(rank==="elite"){ return 2; }\n                return 1;\n            }\n        });\n        owner.setActiveEnemySnapshot(formalSnapshot);\n'''
    elif case_name == "C":
        mutation = '''        // CASE C: explicitly clear active owner state before the action.\n        owner.clearActiveEnemySnapshot();\n'''
    else:
        raise ValueError(case_name)

    logging = f'''        const activeSnapshot=owner.getActiveEnemySnapshot();\n        console.log("CASE {case_name} STATE currentBattleMonsters="+JSON.stringify(Array.from(currentBattleMonsters)));\n        console.log("CASE {case_name} STATE monsters.length="+monsters.length);\n        console.log("CASE {case_name} STATE monster[0].name="+(monsters[0]&&monsters[0].name));\n        console.log("CASE {case_name} STATE v155FinalAbyss="+!!(monsters[0]&&monsters[0].v155FinalAbyss));\n        console.log("CASE {case_name} STATE activeSnapshotExists="+!!activeSnapshot);\n        console.log("CASE {case_name} SNAPSHOT="+JSON.stringify(activeSnapshot?{{\n            originalFormationType:activeSnapshot.originalFormationType,\n            monsterIndexToSlot:activeSnapshot.monsterIndexToSlot,\n            slotToMonsterIndex:activeSnapshot.slotToMonsterIndex\n        }}:null));\n        Math.random=function(){{ return 0; }};\n        console.log("CASE {case_name} BEFORE v141TryMonsterSpecialAction");\n        const action=v141TryMonsterSpecialAction(0);\n        console.log("CASE {case_name} AFTER v141TryMonsterSpecialAction action="+action);\n'''
    return common + mutation + logging


def make_case(base, case_name):
    text = add_owner_path(base)
    text = target_only(text, case_name)
    old = '''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n'''
    new = '''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n''' + state_setup(case_name)
    return replace_once(text, old, new, f"case setup {case_name}")


OUT.mkdir(exist_ok=True)
source_v170 = V170.read_text()
source_v155 = V155.read_text()

instrumented = instrument_v155(source_v155)
V155.write_text(instrumented)
print("instrumented workspace copy:", V155)

for case_name in ("A", "B", "C"):
    path = OUT / f"v170-case-{case_name.lower()}.test.js"
    path.write_text(make_case(source_v170, case_name))
    print(path)
