from pathlib import Path


def replace_test(text, title, next_title, block):
    start = text.find(f'test("{title}"')
    if start < 0:
        return text
    end = text.find(f'\ntest("{next_title}"', start)
    if end < 0:
        raise RuntimeError(f"next test not found after {title}")
    return text[:start] + block.rstrip() + "\n" + text[end:]


# V166: the two formerly Canvas-special-cased Water sheets are now ordinary DOM Sprite Sheets.
p = Path("tests/v166-water-vfx.test.js")
s = p.read_text()
old = '''        if(["waterBall","iceArrowRain"].includes(id)){
            assert.equal(model.sprite.renderer,"canvas-crop",id+" Canvas renderer");
            assert.deepEqual([model.sprite.frameWidth,model.sprite.frameHeight],[384,384],id+" fixed source crop");
        }
'''
new = '''        assert.equal(model.sprite.renderer,"dom-sprite",id+" DOM Sprite renderer");
'''
s = s.replace(old, new)
p.write_text(s)


# V173.23 Wind: retain asset/mapping/geometry assertions, retire Canvas implementation details.
p = Path("tests/v173.23-wind-vfx.test.js")
s = p.read_text()
s = s.replace(
'''        assert.deepEqual(
            Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.frameWidth,model.sprite.frameHeight,model.sprite.hitFrame]),
            [4,3,12,384,384,7],id
        );
        assert.equal(model.sprite.placement,spec.placement,id);
        assert.equal(model.sprite.renderer,"canvas-crop",id);
        assert.equal(model.sprite.naturalGrid,true,id);
''',
'''        assert.deepEqual(
            Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame]),
            [4,3,12,7],id
        );
        assert.equal(model.sprite.placement,spec.placement,id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
'''
)
s = s.replace(
'''        assert.deepEqual(
            Array.from([sprite.columns,sprite.rows,sprite.frames,sprite.frameWidth,sprite.frameHeight]),
            [4,2,8,256,256],type
        );
        assert.equal(sprite.duration,spec.duration,type);
''',
'''        assert.deepEqual(
            Array.from([sprite.columns,sprite.rows,sprite.frames]),
            [4,2,8],type
        );
        assert.equal(sprite.renderer,"dom-sprite",type);
        assert.equal(sprite.duration,spec.duration,type);
'''
)
s = replace_test(
    s,
    "natural-grid Canvas crops exactly one row-major frame and reuses the preload cache",
    "single, three-lane and battlefield casts each own one correctly positioned sheet",
'''test("Wind casts use one DOM Sprite Sheet node and never invoke Canvas drawing",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:2}
    );
    const {stage,sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.renderer,"dom-sprite");
    assert.equal(sprite.dataset.targetIndex,"2");
    assert.equal(sprite.style.left,"578px");
    assert.equal(sprite.style.top,"140px");
    assert.match(sprite.style.backgroundImage,/暴風拳-技能動態圖\.png\?v=173\.24/);
    assert.equal(stage.children.length,1,"no procedural charge, flight, field or hit node");
    assert.equal(runtime.drawCalls.length,0,"DOM Sprite renderer must never call Canvas drawImage");
});'''
)
p.write_text(s)


# V173.39 Earth/Light: retain formal sheets/status ownership while removing Canvas crop assumptions.
p = Path("tests/v173.39-earth-light-vfx.test.js")
s = p.read_text()
s = s.replace(
'test("all casts use row-major canvas cropping, frame seven impact and the requested placement/timing",()=>{',
'test("all casts use DOM Sprite Sheets, frame seven impact and the requested placement/timing",()=>{'
)
s = s.replace(
'''        assert.deepEqual(Array.from([
            model.sprite.columns,model.sprite.rows,model.sprite.frames,
            model.sprite.frameWidth,model.sprite.frameHeight,model.sprite.hitFrame
        ]),[4,3,12,384,384,7],id);
        assert.equal(model.sprite.renderer,"canvas-crop",id);
        assert.equal(model.sprite.naturalGrid,true,id);
''',
'''        assert.deepEqual(Array.from([
            model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame
        ]),[4,3,12,7],id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
'''
)
s = s.replace(
'''        assert.deepEqual(Array.from([model.columns,model.rows,model.frames,model.frameWidth,model.frameHeight]),[4,2,8,256,256],type);
        assert.equal(model.duration,spec.duration,type);
''',
'''        assert.deepEqual(Array.from([model.columns,model.rows,model.frames]),[4,2,8],type);
        assert.equal(model.renderer,"dom-sprite",type);
        assert.equal(model.duration,spec.duration,type);
'''
)
s = s.replace(
'''    assert.match(animation,/sprite\.preserveSourceAspect&&sourceWidth>0&&sourceHeight>0/);
    assert.match(animation,/const cellAspect=Math\.max\(\.1,Number\(spec\.cellAspect\)\|\|1\)/);
''',
'''    assert.match(animation,/const cellAspect=Math\.max\(\.1,Number\(spec\.cellAspect\)\|\|1\)/);
    assert.doesNotMatch(animation,/drawImage\(|getContext\(|canvas-crop/);
'''
)
s = replace_test(
    s,
    "the new Wanxiang loop retires the old procedural text/frame effect instead of stacking both",
    "V173.39 cache version loads the new owner code without stale V173.38 browser assets",
'''test("the Wanxiang loop is raster-owned and the old procedural corner effect is absent",()=>{
    assert.doesNotMatch(legacyEarth,/v143-earth-shield-effect/);
    assert.match(animation,/earthShield:statusSheet\("assets\/vfx\/earth\/earth-shield-loop\.png\?v=173\.39",1000,"activeBuffs"/);
});'''
)
p.write_text(s)
