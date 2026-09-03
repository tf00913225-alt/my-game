from pathlib import Path
import re

path=Path("tests/v166-water-vfx.test.js")
text=path.read_text()

first=re.compile(
    r'test\("Ice Arrow Rain uses one living-target bounding box",\(\)=>\{.*?\n\}\);\n\n(?=test\("enemy Ice Arrow Rain)',
    re.S
)
replacement=r'''test("Ice Arrow Rain keeps one fixed full-enemy-formation footprint",()=>{
    const results=[];
    [[1],[0,1,2]].forEach(indexes=>{
        const monsters=[0,1,2].map(index=>({
            alive:indexes.includes(index),hp:indexes.includes(index)?100:0,
            statusEffects:[],activeBuffs:[]
        }));
        const runtime=loadRuntime({monsters,targetIndexes:indexes});
        runtime.context.v142SkillAnimationDirector.play(
            castConfig("iceArrowRain","all"),
            {side:"player",actorIndex:0}
        );
        const {sprites}=stageSprites(runtime);
        assert.equal(sprites.length,1,indexes.join(","));
        const sprite=sprites[0];
        assert.equal(sprite.dataset.targetSide,"monster");
        assert.equal(sprite.dataset.placement,"battlefield");
        assert.equal(sprite.dataset.areaId,"battleMonsterArea");
        assert.equal(sprite.dataset.fixedFormation,"true");
        assert.equal(sprite.dataset.targetIndexes,indexes.join(","));
        assert.equal(sprite.style.left,"480px");
        assert.equal(sprite.style.top,"170px");
        assert.equal(sprite.style.clipPath||sprite.style["clip-path"],"none");
        assert.equal(sprite.querySelectorAll(".v166-water-battlefield-tile").length,0);
        results.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(results[0],["480px","170px","537px","317px"]);
    assert.deepEqual(results[1],results[0]);
});

'''
match=first.search(text)
if not match:
    raise SystemExit("legacy player Ice Arrow Rain test not found")
text=text[:match.start()]+replacement+text[match.end():]

second=re.compile(
    r'test\("enemy Ice Arrow Rain uses living player cards only",\(\)=>\{.*?\n\}\);\n\n(?=test\("enemy Tidal Beast)',
    re.S
)
replacement2=r'''test("enemy Ice Arrow Rain stays centered on the complete player formation",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("iceArrowRain","all"),{side:"monster",actorIndex:0}
    );
    const {sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetSide,"player");
    assert.equal(sprites[0].dataset.areaId,"battlePlayerRow");
    assert.equal(sprites[0].dataset.fixedFormation,"true");
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(sprites[0].style.left,"240px");
    assert.equal(sprites[0].style.top,"420px");
    assert.equal(sprites[0].style.width,"537px");
    assert.equal(sprites[0].style.height,"195px");
    assert.equal(sprites[0].style.clipPath||sprites[0].style["clip-path"],"none");
    assert.equal(sprites[0].querySelectorAll(".v166-water-battlefield-tile").length,0);
});

'''
match=second.search(text)
if not match:
    raise SystemExit("legacy enemy Ice Arrow Rain test not found")
path.write_text(text[:match.start()]+replacement2+text[match.end():])
