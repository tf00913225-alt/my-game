from pathlib import Path

path = Path("js/39-v143-skill-animation.js")
text = path.read_text(encoding="utf-8")

old = '''        placeSprite(current,node,index,target);\n    requestSpriteAspect(sprite,current,node,index,target);\n    if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }\n    }'''
new = '''        placeSprite(current,node,index,target);\n        requestSpriteAspect(sprite,current,node,index,target);\n        /* A formal cast Sprite represents the attempted skill, not only a landed hit.\n           Reveal it as soon as the official owner has a real target position.\n           Outcome confirmation still marks the node and controls hit feedback, but\n           MISS/status/custom Boss paths must not make the cast animation disappear. */\n        if(node.style.left&&node.style.top){\n            node.style.visibility="visible";\n            node.dataset.emittedVisual="true";\n        }\n        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"addSprite owner anchor mismatch: {text.count(old)}")
text = text.replace(old, new)

old = '''    function missDelayFor(targetSide,index){\n        const current=state.current;\n        if(!current||current.done||current.targetSide!==targetSide){ return 0; }\n        if(current.targetIndexes.indexOf(index)<0&&!current.validTargets.has(index)){ return 0; }\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n\n'''
if text.count(old) != 1:
    raise SystemExit(f"missDelayFor anchor mismatch: {text.count(old)}")
text = text.replace(old, "")

old = '''            const isMiss=String(label||"MISS").trim().toUpperCase()==="MISS";\n            const wait=isMiss?missDelayFor(targetSide,index):delayFor(targetSide,index,true);'''
new = '''            /* MISS is still an attempted cast. Register the resolved target through\n               the same formal V143 path so late-known monster/Boss targets get\n               their real Sprite Sheet while the MISS popup keeps hit timing. */\n            const wait=delayFor(targetSide,index,true);'''
if text.count(old) != 1:
    raise SystemExit(f"showMissEffect anchor mismatch: {text.count(old)}")
text = text.replace(old, new)

path.write_text(text, encoding="utf-8")

test_path = Path("tests/boss-vfx-reliability-20260914.test.js")
test_text = test_path.read_text(encoding="utf-8")
old_test = '    assert.deepEqual(current.targetIndexes,[0,1]);'
new_test = '    assert.deepEqual(Array.from(current.targetIndexes),[0,1]);'
if test_text.count(old_test) == 1:
    test_text = test_text.replace(old_test, new_test)
elif test_text.count(new_test) != 1:
    raise SystemExit("cross-realm assertion anchor mismatch")
test_path.write_text(test_text, encoding="utf-8")

fire_test = Path("tests/v153-fire-vfx.test.js")
fire_text = fire_test.read_text(encoding="utf-8")
old_fire = '''test("MISS keeps the skill Sprite hidden and shows only MISS feedback",()=>{\n    const runtime=loadRuntime();\n    runtime.context.v142SkillAnimationDirector.play(\n        castConfig("flameSlash",760,"single"),{side:"player",actorIndex:0}\n    );\n    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");\n    const sprite=stage.children.find(node=>node.className.includes("v143-vfx-sprite"));\n    assert.ok(sprite);\n    assert.equal(sprite.style.visibility,"hidden","unconfirmed skill VFX starts hidden");\n    const before=runtime.scheduled.length;\n    runtime.context.showMissEffect(false,1,"MISS");\n    assert.equal(sprite.style.visibility,"hidden","MISS must not reveal the skill VFX");\n    assert.equal(runtime.scheduled.length,before+1);\n    runtime.scheduled[runtime.scheduled.length-1].callback();\n    assert.equal(sprite.style.visibility,"hidden","skill VFX remains hidden after MISS text appears");\n    assert.equal(runtime.misses.length,1);\n    assert.equal(runtime.misses[0][2],"MISS");\n});'''
new_fire = '''test("MISS still plays the formal skill Sprite and keeps MISS feedback on hit timing",()=>{\n    const runtime=loadRuntime();\n    runtime.context.v142SkillAnimationDirector.play(\n        castConfig("flameSlash",760,"single"),{side:"player",actorIndex:0}\n    );\n    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");\n    const sprite=stage.children.find(node=>node.className.includes("v143-vfx-sprite"));\n    assert.ok(sprite);\n    assert.equal(sprite.style.visibility,"visible","a positioned cast Sprite is visible before outcome resolution");\n    const before=runtime.scheduled.length;\n    runtime.context.showMissEffect(false,1,"MISS");\n    assert.equal(sprite.style.visibility,"visible","MISS must not suppress the attempted skill animation");\n    assert.equal(sprite.dataset.confirmedHit,"true","MISS resolves the target through the formal V143 endpoint");\n    assert.equal(runtime.scheduled.length,before+1);\n    runtime.scheduled[runtime.scheduled.length-1].callback();\n    assert.equal(sprite.style.visibility,"visible","skill VFX remains visible while MISS feedback resolves");\n    assert.equal(runtime.misses.length,1);\n    assert.equal(runtime.misses[0][2],"MISS");\n});'''
if fire_text.count(old_fire) != 1:
    raise SystemExit(f"fire MISS regression anchor mismatch: {fire_text.count(old_fire)}")
fire_test.write_text(fire_text.replace(old_fire, new_fire), encoding="utf-8")
