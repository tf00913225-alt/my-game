from pathlib import Path

V170=Path("tests/v170-final-spec-integration.test.js")
V143=Path("js/39-v143-skill-animation.js")
MAIN=Path("js/00-main.js")
V131=Path("js/25-v131-fix-batch.js")
OUT=Path(".diagnostic")
TARGET="same-name states miss without refresh while differently named hard controls coexist"


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old,new,1)


def add_owner_path(text):
    return replace_once(
        text,
        'const EXPECTED_RUNTIME_PATHS=[\n    "js/25-v131-fix-batch.js",',
        'const EXPECTED_RUNTIME_PATHS=[\n    "js/battlefield-slot-owner.js",\n    "js/25-v131-fix-batch.js",',
        "owner runtime path"
    )


def target_only(text,label):
    old='''let passed=0;\nfunction test(name,handler){\n    handler();\n    passed++;\n    console.log("✓ "+name);\n}\n'''
    new=f'''let passed=0;\nfunction test(name,handler){{\n    if(name!=={TARGET!r}){{ return; }}\n    console.log("{label} TEST START "+name);\n    handler();\n    passed++;\n    console.log("{label} TEST PASS "+name);\n}}\n'''
    return replace_once(text,old,new,f"test helper {label}")


def instrument_v143(source):
    text=source
    old='''    function delayFor(targetSide,index,allowDefeated){\n        const current=registerTarget(targetSide,index,allowDefeated);\n        if(!current){ return 0; }\n        confirmTargetVisual(current,index);\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n'''
    new='''    function delayFor(targetSide,index,allowDefeated){\n        console.log("DELAY 1 enter side="+targetSide+" index="+index);\n        console.log("DELAY 2 before registerTarget");\n        const current=registerTarget(targetSide,index,allowDefeated);\n        console.log("DELAY 3 after registerTarget current="+!!current);\n        if(!current){ return 0; }\n        console.log("DELAY 4 before confirmTargetVisual");\n        confirmTargetVisual(current,index);\n        console.log("DELAY 5 after confirmTargetVisual");\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n'''
    text=replace_once(text,old,new,"delayFor markers")
    old='''    function officialCardEffect(side,index){\n        const args=Array.prototype.slice.call(arguments);\n        const potionTarget=window.v143LastPotionEffectTarget;\n'''
    new='''    function officialCardEffect(side,index){\n        console.log("CARD 1 official enter side="+side+" index="+index+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n        const args=Array.prototype.slice.call(arguments);\n        const potionTarget=window.v143LastPotionEffectTarget;\n'''
    text=replace_once(text,old,new,"official card enter")
    old='''        const wait=delayFor(side,index,false);\n        const invoke=function(){\n'''
    new='''        console.log("CARD 2 before delayFor");\n        const wait=delayFor(side,index,false);\n        console.log("CARD 3 after delayFor wait="+wait);\n        const invoke=function(){\n'''
    text=replace_once(text,old,new,"official card delay markers")
    return text


def instrument_main(source):
    text=source
    old='''    renderBattle();\n\n    showPage("battle");\n'''
    new='''    console.log("LIFE originalStartBattle before render battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n    renderBattle();\n    console.log("LIFE originalStartBattle after render battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n\n    showPage("battle");\n'''
    text=replace_once(text,old,new,"main render markers")
    old='''    startTurn(\n        battleToken\n    );\n\n}\n\n\n/* =====================================================\n   回合\n'''
    new='''    console.log("LIFE originalStartBattle before startTurn battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n    startTurn(\n        battleToken\n    );\n    console.log("LIFE originalStartBattle end battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n\n}\n\n\n/* =====================================================\n   回合\n'''
    return replace_once(text,old,new,"main startTurn/end markers")


def instrument_v131(source):
    text=source
    old='''        startBattle=function(){\n            const slotOwner=fixedBattlefieldSlots();\n            if(slotOwner){ slotOwner.clearActiveEnemySnapshot(); }\n'''
    new='''        startBattle=function(){\n            const slotOwner=fixedBattlefieldSlots();\n            console.log("LIFE wrapper before clear battleActive="+battleActive+" snapshot="+JSON.stringify(slotOwner?slotOwner.getActiveEnemySnapshot():null));\n            if(slotOwner){ slotOwner.clearActiveEnemySnapshot(); }\n            console.log("LIFE wrapper after clear battleActive="+battleActive+" snapshot="+JSON.stringify(slotOwner?slotOwner.getActiveEnemySnapshot():null));\n'''
    text=replace_once(text,old,new,"V131 wrapper clear markers")
    old='''            const result=originalStartBattle.apply(this,arguments);\n            if(battleActive){\n                ensureEnemyFormationSnapshot(currentBattleMonsters);\n                syncElementBoxForBattle({silent:true});\n            }\n            return result;\n'''
    new='''            const result=originalStartBattle.apply(this,arguments);\n            console.log("LIFE wrapper after originalStartBattle battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(slotOwner?slotOwner.getActiveEnemySnapshot():null));\n            if(battleActive){\n                ensureEnemyFormationSnapshot(currentBattleMonsters);\n                console.log("LIFE wrapper after ensure battleActive="+battleActive+" roster="+JSON.stringify(currentBattleMonsters)+" snapshot="+JSON.stringify(slotOwner?slotOwner.getActiveEnemySnapshot():null));\n                syncElementBoxForBattle({silent:true});\n            }\n            return result;\n'''
    text=replace_once(text,old,new,"V131 wrapper after markers")
    old='''        renderBattle=function(){\n            originalRenderBattle.apply(this,arguments);\n            applyBattleFormation();\n            applyAllyBattleFormation();\n'''
    new='''        renderBattle=function(){\n            originalRenderBattle.apply(this,arguments);\n            console.log("LIFE renderBattle before applyBattleFormation snapshot="+JSON.stringify(fixedBattlefieldSlots()?fixedBattlefieldSlots().getActiveEnemySnapshot():null));\n            applyBattleFormation();\n            console.log("LIFE renderBattle after applyBattleFormation snapshot="+JSON.stringify(fixedBattlefieldSlots()?fixedBattlefieldSlots().getActiveEnemySnapshot():null));\n            applyAllyBattleFormation();\n'''
    return replace_once(text,old,new,"V131 render markers")


def lifecycle_case(base):
    text=target_only(add_owner_path(base),"CASE 1")
    old='''        monsters.splice(0,monsters.length,{\n            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,\n            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],\n            v141Abyss:true,v155FinalAbyss:true\n        });\n        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n'''
    new='''        const owner=FourSymbolsBattlefieldSlots;\n        battleActive=false;\n        mapCooldown=false;\n        owner.clearActiveEnemySnapshot();\n        Math.random=function(){ return 0; };\n        const triggerIndex=monsters.findIndex(monster=>monster&&monster.alive!==false);\n        if(triggerIndex<0){ throw new Error("CASE 1 could not find a formal patrol monster"); }\n        console.log("CASE 1 before startBattle battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n        startBattle(triggerIndex);\n        console.log("CASE 1 after startBattle battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n        const actionIndex=currentBattleMonsters[0];\n        Object.assign(monsters[actionIndex],{\n            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,\n            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],\n            v141Abyss:true,v155FinalAbyss:true\n        });\n        console.log("CASE 1 before first monster action battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n        const action=v141TryMonsterSpecialAction(actionIndex);\n        console.log("CASE 1 after monster action action="+action+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n'''
    text=replace_once(text,old,new,"CASE 1 formal lifecycle")
    old='''        return {burn:burn,afterPetrify:afterPetrify,afterFreeze:afterFreeze,action:action,sp:monsters[0].sp};\n'''
    new='''        return {burn:burn,afterPetrify:afterPetrify,afterFreeze:afterFreeze,action:action,sp:monsters[actionIndex].sp};\n'''
    return replace_once(text,old,new,"CASE 1 result index")


def direct_case(base):
    text=target_only(add_owner_path(base),"CASE 2")
    old='''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n'''
    new='''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        const owner=FourSymbolsBattlefieldSlots;\n        owner.clearActiveEnemySnapshot();\n        Math.random=function(){ return 0; };\n        console.log("CASE 2 direct mutation battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n        const action=v141TryMonsterSpecialAction(0);\n        console.log("CASE 2 after monster action action="+action);\n'''
    return replace_once(text,old,new,"CASE 2 direct mutation")


OUT.mkdir(exist_ok=True)
base=V170.read_text()
V143.write_text(instrument_v143(V143.read_text()))
MAIN.write_text(instrument_main(MAIN.read_text()))
V131.write_text(instrument_v131(V131.read_text()))
(OUT/"v170-lifecycle-case-1.test.js").write_text(lifecycle_case(base))
(OUT/"v170-direct-case-2.test.js").write_text(direct_case(base))
print("instrumented workspace-only runtime copies")
print(OUT/"v170-lifecycle-case-1.test.js")
print(OUT/"v170-direct-case-2.test.js")
