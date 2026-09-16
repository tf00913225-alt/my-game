from pathlib import Path

V170=Path("tests/v170-final-spec-integration.test.js")
V143=Path("js/39-v143-skill-animation.js")
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


def equal_document_mock(text,label):
    text=replace_once(
        text,
        '            if(property==="querySelector"){ return ()=>null; }\n',
        '            if(property==="querySelector"){ return ()=>node; }\n',
        f"{label} universal node querySelector"
    )
    old='''    const document={\n        readyState:"loading",hidden:false,body:dummy,head:dummy,documentElement:dummy,\n        activeElement:null,getElementById:()=>dummy,querySelector:()=>null,querySelectorAll:()=>[],\n'''
    new='''    const document={\n        readyState:"loading",hidden:false,body:dummy,head:dummy,documentElement:dummy,\n        activeElement:null,getElementById:()=>dummy,querySelector:()=>dummy,querySelectorAll:()=>[],\n'''
    return replace_once(text,old,new,f"{label} document querySelector")


def instrument_v143(source):
    text=source

    old='''    function delayFor(targetSide,index,allowDefeated){\n        const current=registerTarget(targetSide,index,allowDefeated);\n        if(!current){ return 0; }\n        confirmTargetVisual(current,index);\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n'''
    new='''    function delayFor(targetSide,index,allowDefeated){\n        console.log("DELAY 1 enter side="+targetSide+" index="+index);\n        console.log("DELAY 2 before registerTarget");\n        const current=registerTarget(targetSide,index,allowDefeated);\n        console.log("DELAY 3 after registerTarget current="+!!current);\n        if(!current){ return 0; }\n        console.log("DELAY 4 before confirmTargetVisual");\n        confirmTargetVisual(current,index);\n        console.log("DELAY 5 after confirmTargetVisual");\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n'''
    text=replace_once(text,old,new,"delayFor markers")

    old='''    function syncStatusSprite(side,index,type){\n        const spec=STATUS_SPRITES[type];\n        const card=cardFor(side,index);\n        const entity=entityFor(side,index);\n        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));\n        const active=alive&&hasTimedEffect(entity,type);\n        let node=statusNode(card,type);\n        if(!active||deferredStatusDuringCast(side,index,type)){\n            if(node&&typeof node.remove==="function"){ node.remove(); }\n            else if(node&&node.parentNode){ node.parentNode.removeChild(node); }\n            return;\n        }\n        if(!node){\n            node=document.createElement("i");\n            node.className="v153-status-vfx v153-status-vfx-"+type;\n            node.dataset.statusType=type;\n            node.dataset.frames=String(spec.frames);\n            node.dataset.renderer="dom-sprite";\n            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }\n            node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';\n            node.style.backgroundSize=(spec.columns*100)+"% "+(spec.rows*100)+"%";\n            node.style.setProperty("--v153-status-duration",spec.duration+"ms");\n            card.appendChild(node);\n        }\n        const anchor=slotAnchor(side,index,card);\n        if(!anchor){ return; }\n        const scale=(Number(spec.scale)||1.18)*1.28;\n        const size=Math.max(96,Math.max(anchor.rect.width,anchor.rect.height)*scale);\n        const cellAspect=Math.max(.1,Number(spec.cellAspect)||1);\n        node.dataset.slot=anchor.slot;\n        if(cellAspect>=1){\n            node.style.width=size+"px";\n            node.style.height=(size/cellAspect)+"px";\n        }else{\n            node.style.width=(size*cellAspect)+"px";\n            node.style.height=size+"px";\n        }\n    }\n\n    function syncStatusSpriteEffects(){\n        purgeLegacyCardVfx();\n        const types=Object.keys(RAW_STATUS_SPRITES);\n        for(let index=0;index<10;index++){ types.forEach(type=>syncStatusSprite("monster",index,type)); }\n        for(let index=0;index<3;index++){ types.forEach(type=>syncStatusSprite("player",index,type)); }\n    }\n'''
    new='''    function syncStatusSprite(side,index,type){\n        const diagnosisSnapshot=side==="monster"&&window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot\n            ?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null;\n        console.log("SPRITE 1 enter side="+side+" index="+index+" type="+type+" snapshot="+(side==="monster"?JSON.stringify(diagnosisSnapshot):"n/a"));\n        console.log("SPRITE 2 before STATUS_SPRITES lookup");\n        const spec=STATUS_SPRITES[type];\n        console.log("SPRITE 3 after STATUS_SPRITES lookup spec="+!!spec);\n        console.log("SPRITE 4 before cardFor");\n        const card=cardFor(side,index);\n        console.log("SPRITE 5 after cardFor card="+!!card);\n        console.log("SPRITE 6 before entityFor");\n        const entity=entityFor(side,index);\n        console.log("SPRITE 7 after entityFor entity="+!!entity);\n        console.log("SPRITE 8 before alive check");\n        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));\n        console.log("SPRITE 9 before hasTimedEffect alive="+alive);\n        const active=alive&&hasTimedEffect(entity,type);\n        console.log("SPRITE 10 after hasTimedEffect active="+active);\n        console.log("SPRITE 11 before existing status node lookup");\n        let node=statusNode(card,type);\n        console.log("SPRITE 12 after existing status node lookup node="+!!node);\n        console.log("SPRITE 13 before inactive/deferred branch");\n        if(!active||deferredStatusDuringCast(side,index,type)){\n            console.log("SPRITE 14 branch remove/inactive");\n            console.log("SPRITE 15 before remove status VFX node");\n            if(node&&typeof node.remove==="function"){ node.remove(); }\n            else if(node&&node.parentNode){ node.parentNode.removeChild(node); }\n            console.log("SPRITE 16 after remove status VFX node");\n            console.log("SPRITE RETURN inactive/deferred");\n            return;\n        }\n        console.log("SPRITE 14 after inactive/deferred branch active=true");\n        if(!node){\n            console.log("SPRITE 15 before create status VFX node");\n            node=document.createElement("i");\n            node.className="v153-status-vfx v153-status-vfx-"+type;\n            node.dataset.statusType=type;\n            node.dataset.frames=String(spec.frames);\n            node.dataset.renderer="dom-sprite";\n            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }\n            node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';\n            node.style.backgroundSize=(spec.columns*100)+"% "+(spec.rows*100)+"%";\n            node.style.setProperty("--v153-status-duration",spec.duration+"ms");\n            card.appendChild(node);\n            console.log("SPRITE 16 after create status VFX node");\n        }else{\n            console.log("SPRITE 15/16 create status VFX node skipped existing=true");\n        }\n        console.log("SPRITE 17 before slot/card geometry lookup slotAnchor");\n        const anchor=slotAnchor(side,index,card);\n        console.log("SPRITE 18 after slot/card geometry lookup slotAnchor anchor="+!!anchor+(anchor?" slot="+anchor.slot:""));\n        if(!anchor){ console.log("SPRITE RETURN no anchor"); return; }\n        const scale=(Number(spec.scale)||1.18)*1.28;\n        const size=Math.max(96,Math.max(anchor.rect.width,anchor.rect.height)*scale);\n        const cellAspect=Math.max(.1,Number(spec.cellAspect)||1);\n        node.dataset.slot=anchor.slot;\n        if(cellAspect>=1){\n            node.style.width=size+"px";\n            node.style.height=(size/cellAspect)+"px";\n        }else{\n            node.style.width=(size*cellAspect)+"px";\n            node.style.height=size+"px";\n        }\n        console.log("SPRITE 19 geometry/style complete");\n        console.log("SPRITE RETURN complete");\n    }\n\n    function syncStatusSpriteEffects(){\n        console.log("STATUS 1 enter");\n        console.log("STATUS 2 before purgeLegacyCardVfx");\n        purgeLegacyCardVfx();\n        console.log("STATUS 3 after purgeLegacyCardVfx");\n        const types=Object.keys(RAW_STATUS_SPRITES);\n        console.log("STATUS 4 types ready length="+types.length);\n        for(let index=0;index<10;index++){\n            types.forEach(type=>{\n                console.log("STATUS CALL monster "+index+" "+type);\n                syncStatusSprite("monster",index,type);\n                console.log("STATUS RETURN monster "+index+" "+type);\n            });\n        }\n        for(let index=0;index<3;index++){\n            types.forEach(type=>{\n                console.log("STATUS CALL player "+index+" "+type);\n                syncStatusSprite("player",index,type);\n                console.log("STATUS RETURN player "+index+" "+type);\n            });\n        }\n        console.log("STATUS 5 return");\n    }\n'''
    text=replace_once(text,old,new,"status sync markers")

    old='''    function officialCardEffect(side,index){\n        const args=Array.prototype.slice.call(arguments);\n        const potionTarget=window.v143LastPotionEffectTarget;\n'''
    new='''    function officialCardEffect(side,index){\n        console.log("CARD 1 official enter side="+side+" index="+index+" snapshot="+JSON.stringify(window.FourSymbolsBattlefieldSlots&&window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot?window.FourSymbolsBattlefieldSlots.getActiveEnemySnapshot():null));\n        const args=Array.prototype.slice.call(arguments);\n        const potionTarget=window.v143LastPotionEffectTarget;\n'''
    text=replace_once(text,old,new,"official card enter")

    old='''        const wait=delayFor(side,index,false);\n        const invoke=function(){\n            syncStatusSpriteEffects();\n            setTimer(syncStatusSpriteEffects,0);\n        };\n        if(wait>8){ setTimer(invoke,wait); }else{ invoke(); }\n    }\n'''
    new='''        console.log("CARD 2 before delayFor");\n        const wait=delayFor(side,index,false);\n        console.log("CARD 3 after delayFor wait="+wait);\n        const invoke=function(){\n            console.log("CARD 5 invoke enter");\n            console.log("SYNC 1 before syncStatusSpriteEffects immediate");\n            syncStatusSpriteEffects();\n            console.log("SYNC 2 after syncStatusSpriteEffects immediate");\n            console.log("TIMER 1 before schedule second sync");\n            setTimer(syncStatusSpriteEffects,0);\n            console.log("TIMER 2 after schedule second sync");\n            console.log("CARD 6 invoke return");\n        };\n        console.log("CARD 4 before invoke");\n        if(wait>8){ setTimer(invoke,wait); }else{ invoke(); }\n        console.log("CARD 7 official return");\n    }\n'''
    return replace_once(text,old,new,"official card tail markers")


def formal_case(base):
    text=target_only(add_owner_path(base),"FORMAL")
    text=equal_document_mock(text,"FORMAL")
    old='''        monsters.splice(0,monsters.length,{\n            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,\n            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],\n            v141Abyss:true,v155FinalAbyss:true\n        });\n        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n'''
    new='''        const owner=FourSymbolsBattlefieldSlots;\n        battleActive=false;\n        mapCooldown=false;\n        owner.clearActiveEnemySnapshot();\n        Math.random=function(){ return 0; };\n        console.log("FORMAL lifecycle before startBattle battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n        startBattle(0);\n        const lifecycleSnapshot=owner.getActiveEnemySnapshot();\n        console.log("FORMAL lifecycle after startBattle battleActive="+battleActive+" roster="+JSON.stringify(Array.from(currentBattleMonsters))+" snapshot="+JSON.stringify(lifecycleSnapshot));\n        if(!battleActive){ throw new Error("FORMAL battleActive must be true after startBattle"); }\n        if(currentBattleMonsters.length!==1||currentBattleMonsters[0]!==0){ throw new Error("FORMAL roster must be [0]"); }\n        if(!lifecycleSnapshot){ throw new Error("FORMAL snapshot must exist"); }\n        if(lifecycleSnapshot.monsterIndexToSlot[0]!=="ENEMY_F3"){ throw new Error("FORMAL monster 0 must occupy ENEMY_F3"); }\n        Object.assign(monsters[0],{\n            name:"極帝天尊",element:"light",level:100,hp:1000,maxHP:1000,sp:500,maxSP:1000,\n            alive:true,evasion:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:1}],\n            v141Abyss:true,v155FinalAbyss:true\n        });\n        console.log("FORMAL 1 before special "+JSON.stringify({\n            battleActive:battleActive,currentBattleMonsters:Array.from(currentBattleMonsters),\n            activeSnapshot:owner.getActiveEnemySnapshot(),\n            monsterIndexToSlot:owner.getActiveEnemySnapshot()&&owner.getActiveEnemySnapshot().monsterIndexToSlot,\n            slotToMonsterIndex:owner.getActiveEnemySnapshot()&&owner.getActiveEnemySnapshot().slotToMonsterIndex,\n            monsterName:monsters[0].name,v155FinalAbyss:!!monsters[0].v155FinalAbyss\n        }));\n        console.log("FORMAL 2 call special");\n        const action=window.v141TryMonsterSpecialAction(0);\n        console.log("FORMAL 3 special returned value="+action);\n        console.log("FORMAL 4 after special snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n'''
    return replace_once(text,old,new,"formal lifecycle special call")


def direct_case(base):
    text=target_only(add_owner_path(base),"DIRECT")
    text=equal_document_mock(text,"DIRECT")
    old='''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        Math.random=function(){ return 0; };\n        const action=v141TryMonsterSpecialAction(0);\n'''
    new='''        currentBattleMonsters.splice(0,currentBattleMonsters.length,0);\n        const owner=FourSymbolsBattlefieldSlots;\n        owner.clearActiveEnemySnapshot();\n        Math.random=function(){ return 0; };\n        console.log("DIRECT 1 before special "+JSON.stringify({\n            battleActive:battleActive,currentBattleMonsters:Array.from(currentBattleMonsters),\n            activeSnapshot:owner.getActiveEnemySnapshot(),monsterName:monsters[0]&&monsters[0].name,\n            v155FinalAbyss:!!(monsters[0]&&monsters[0].v155FinalAbyss)\n        }));\n        console.log("DIRECT 2 call special");\n        const action=window.v141TryMonsterSpecialAction(0);\n        console.log("DIRECT 3 special returned value="+action);\n        console.log("DIRECT 4 after special snapshot="+JSON.stringify(owner.getActiveEnemySnapshot()));\n'''
    return replace_once(text,old,new,"direct mutation special call")


OUT.mkdir(exist_ok=True)
base=V170.read_text()
V143.write_text(instrument_v143(V143.read_text()))
(OUT/"v170-formal-final-b.test.js").write_text(formal_case(base))
(OUT/"v170-direct-final-b.test.js").write_text(direct_case(base))
print("instrumented V143 workspace-only and generated equal-mock final B cases")
print(OUT/"v170-formal-final-b.test.js")
print(OUT/"v170-direct-final-b.test.js")
