from pathlib import Path


def replace_once(path, old, new, label):
    file=Path(path)
    text=file.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    file.write_text(text.replace(old,new,1))


replace_once(
    "tests/v173.11-abyss-vfx-dungeon.test.js",
    'placement:"battlefield",renderer:"canvas-crop",targetBounds:true,coverageScale:1\\.22',
    'placement:"battlefield",renderer:"canvas-crop",fixedFormation:true,coverageScale:1\\.22',
    "V173.11 Ice Arrow Rain manifest"
)

replace_once(
    "tests/v173.5-bugfixes.test.js",
    'placement:"battlefield",renderer:"canvas-crop",targetBounds:true,coverageScale:1\\.22,',
    'placement:"battlefield",renderer:"canvas-crop",fixedFormation:true,coverageScale:1\\.22,',
    "V173.5 Ice Arrow Rain manifest"
)

path=Path("tests/v173.13-canvas-vfx-abyss-input.test.js")
text=path.read_text()
old='''    const body=makeNode();
    const nodes={};
    const monsterRects=['''
new='''    const body=makeNode();
    const nodes={};
    const monsterArea=makeNode({left:240,top:30,right:680,bottom:300,width:440,height:270});
    monsterArea.id="battleMonsterArea";
    nodes[monsterArea.id]=monsterArea;
    body.appendChild(monsterArea);
    const playerArea=makeNode({left:20,top:350,right:460,bottom:500,width:440,height:150});
    playerArea.id="battlePlayerRow";
    nodes[playerArea.id]=playerArea;
    body.appendChild(playerArea);
    const monsterRects=['''
if text.count(old)!=1:
    raise SystemExit("V173.13 area harness insertion mismatch")
text=text.replace(old,new,1)
old='''    assert.equal(rain.stage.children.filter(node=>node.dataset.renderer==="canvas-crop").length,1);
    assert.equal(rainCanvas.dataset.areaId,"living-targets");
    assert.equal(rainCanvas.dataset.targetIndexes,"0,1,2");'''
new='''    assert.equal(rain.stage.children.filter(node=>node.dataset.renderer==="canvas-crop").length,1);
    assert.equal(rainCanvas.dataset.areaId,"battleMonsterArea");
    assert.equal(rainCanvas.dataset.fixedFormation,"true");
    assert.equal(rainCanvas.dataset.targetIndexes,"0,1,2");
    assert.equal(rainCanvas.style.left,"460px");
    assert.equal(rainCanvas.style.top,"165px");'''
if text.count(old)!=1:
    raise SystemExit("V173.13 Ice Arrow Rain area assertion mismatch")
path.write_text(text.replace(old,new,1))
