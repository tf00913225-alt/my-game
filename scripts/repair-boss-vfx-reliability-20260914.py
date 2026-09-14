from pathlib import Path

path = Path("js/39-v143-skill-animation.js")
text = path.read_text(encoding="utf-8")

old = '''        placeSprite(current,node,index,target);\n    requestSpriteAspect(sprite,current,node,index,target);\n    if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }\n    }'''
new = '''        placeSprite(current,node,index,target);\n        requestSpriteAspect(sprite,current,node,index,target);\n        /* A cast Sprite represents the attempted skill, not only a landed hit.\n           Once the formal owner has a real target position, reveal it immediately.\n           Hit confirmation still marks the node, but MISS/custom Boss damage paths\n           must never leave a correctly positioned Sprite hidden for its lifetime. */\n        if(node.style.left&&node.style.top){\n            node.style.visibility="visible";\n            node.dataset.emittedVisual="true";\n        }\n        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"addSprite owner anchor mismatch: {text.count(old)}")
text = text.replace(old, new)

old = '''    function missDelayFor(targetSide,index){\n        const current=state.current;\n        if(!current||current.done||current.targetSide!==targetSide){ return 0; }\n        if(current.targetIndexes.indexOf(index)<0&&!current.validTargets.has(index)){ return 0; }\n        return Math.max(0,targetHitTime(current,index)-Date.now());\n    }\n\n'''
if text.count(old) != 1:
    raise SystemExit(f"missDelayFor anchor mismatch: {text.count(old)}")
text = text.replace(old, "")

old = '''            const isMiss=String(label||"MISS").trim().toUpperCase()==="MISS";\n            const wait=isMiss?missDelayFor(targetSide,index):delayFor(targetSide,index,true);'''
new = '''            /* MISS still represents a real attempted cast. Route it through the\n               same target registration path so single-target monster/Boss casts\n               receive their formal Sprite even when no damage callback follows. */\n            const wait=delayFor(targetSide,index,true);'''
if text.count(old) != 1:
    raise SystemExit(f"showMissEffect anchor mismatch: {text.count(old)}")
text = text.replace(old, new)

path.write_text(text, encoding="utf-8")

test_path = Path("tests/boss-vfx-reliability-20260914.test.js")
test_text = test_path.read_text(encoding="utf-8")
old_test = '    assert.deepEqual(current.targetIndexes,[0,1]);'
new_test = '    assert.deepEqual(Array.from(current.targetIndexes),[0,1]);'
if test_text.count(old_test) != 1:
    raise SystemExit(f"cross-realm assertion anchor mismatch: {test_text.count(old_test)}")
test_path.write_text(test_text.replace(old_test, new_test), encoding="utf-8")
