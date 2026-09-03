from pathlib import Path
import re
import sys


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old,new,1)


def apply():
    path=Path("js/39-v143-skill-animation.js")
    text=path.read_text()

    text=replace_once(
        text,
        'placement:"battlefield",renderer:"canvas-crop",targetBounds:true,coverageScale:1.22,\n                minWidth:140,minHeight:140',
        'placement:"battlefield",renderer:"canvas-crop",fixedFormation:true,coverageScale:1.22,\n                minWidth:140,minHeight:140',
        "Ice Arrow Rain fixed formation manifest"
    )

    group_pattern=re.compile(
        r'    function groupLayoutBounds\(current,indexes\)\{.*?\n    \}\n\n    function placeSprite',
        re.S
    )
    group_match=group_pattern.search(text)
    if not group_match:
        raise SystemExit("groupLayoutBounds block not found")
    group_replacement=r'''    function formationRowsForVfx(indexes){
        const resolver=typeof window!=="undefined"&&typeof window.v148GetFormationRows==="function"
            ?window.v148GetFormationRows
            :(typeof window!=="undefined"&&typeof window.v138GetFormationRows==="function"
                ?window.v138GetFormationRows:null);
        if(!resolver){ return []; }
        const rows=resolver(indexes||[]);
        return Array.isArray(rows)
            ?rows.filter(row=>Array.isArray(row)&&row.length).map(row=>row.slice())
            :[];
    }

    function fixedTriLayoutBounds(current,indexes){
        const targetType=String(current.config.targetType||"");
        if(targetType==="allyTri"&&current.targetSide==="player"){
            const playerArea=sideAreaBounds("player");
            if(playerArea){
                playerArea.centerX=playerArea.left+playerArea.width/2;
                playerArea.centerY=playerArea.top+playerArea.height/2;
                playerArea.fixedSlots=3;
                return playerArea;
            }
        }

        const queued=current.side==="player"&&typeof queuedPlayerActions!=="undefined"
            ?queuedPlayerActions&&queuedPlayerActions[current.actorIndex]:null;
        let center=Number.isInteger(current.targetId)?current.targetId:null;
        if(center===null&&queued){
            if(current.targetSide==="monster"&&Number.isInteger(queued.target)){ center=queued.target; }
            if(current.targetSide==="player"&&Number.isInteger(queued.targetAlly)){ center=queued.targetAlly; }
        }
        if(center===null&&indexes.length){
            center=indexes[Math.floor((indexes.length-1)/2)];
        }
        const anchorCard=Number.isInteger(center)?cardFor(current.targetSide,center):null;
        const anchor=cardCenter(anchorCard);
        if(!anchor){
            const area=sideAreaBounds(current.targetSide);
            if(area){
                area.centerX=area.left+area.width/2;
                area.centerY=area.top+area.height/2;
                area.fixedSlots=3;
            }
            return area;
        }

        let step=Math.max(1,anchor.rect.width+3);
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const position=row.indexOf(center);
                const neighborIndexes=[row[position-1],row[position+1]].filter(Number.isInteger);
                const distances=neighborIndexes.map(neighborIndex=>cardCenter(cardFor("monster",neighborIndex)))
                    .filter(Boolean).map(neighbor=>Math.abs(neighbor.x-anchor.x)).filter(distance=>distance>1);
                if(distances.length){ step=Math.min.apply(null,distances); }
            }
        }else if(current.targetSide==="player"){
            const partyCenters=[0,1,2].map(partyIndex=>cardCenter(cardFor("player",partyIndex))).filter(Boolean);
            const distances=partyCenters.map(candidate=>Math.abs(candidate.x-anchor.x)).filter(distance=>distance>1);
            if(distances.length){ step=Math.min.apply(null,distances); }
        }

        const width=anchor.rect.width+step*2;
        return {
            left:anchor.x-width/2,
            top:anchor.rect.top,
            width:width,
            height:anchor.rect.height,
            centerX:anchor.x,
            centerY:anchor.y,
            fixedSlots:3,
            id:"fixed-tri-slots"
        };
    }

    function groupLayoutBounds(current,indexes){
        const targetType=String(current.config.targetType||"");
        if(/tri/i.test(targetType)){ return fixedTriLayoutBounds(current,indexes); }
        if(current.targetSide==="player"){
            return sideAreaBounds("player");
        }
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const queued=current.side==="player"&&typeof queuedPlayerActions!=="undefined"
                ?queuedPlayerActions&&queuedPlayerActions[current.actorIndex]:null;
            const center=Number.isInteger(current.targetId)
                ?current.targetId
                :(queued&&Number.isInteger(queued.target)?queued.target:indexes[0]);
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const layout=fieldBounds(row.map(index=>cardFor("monster",index)).filter(Boolean));
                if(layout){ return layout; }
            }
        }
        return fieldBounds(indexes.map(index=>cardFor(current.targetSide,index)).filter(Boolean));
    }

    function placeSprite'''
    text=text[:group_match.start()]+group_replacement+text[group_match.end():]

    battlefield_marker='''            /*\n               Ice Arrow Rain is one VFX instance. Its destination is based\n               only on cards that are still valid targets, never on a fixed\n               side container or a dead/retired card.\n            */\n            const targetCards=indexes.map(targetIndex=>cardFor(current.targetSide,targetIndex))'''
    fixed_branch='''            if(sprite.fixedFormation){\n                const bounds=sideAreaBounds(current.targetSide);\n                if(!bounds){ return; }\n                const viewportWidth=Number(window.innerWidth)||960;\n                const viewportHeight=Number(window.innerHeight)||720;\n                const coverageScale=clamp(Number(sprite.coverageScale)||1,1,1.4);\n                const maxWidth=Math.max(240,Math.min(viewportWidth*.94,Number(sprite.maxWidth)||viewportWidth*.94));\n                const maxHeight=Math.max(240,Math.min(viewportHeight*.92,Number(sprite.maxHeight)||viewportHeight*.92));\n                const width=clamp(\n                    Math.round(bounds.width*coverageScale),\n                    Number(sprite.minWidth)||160,\n                    maxWidth\n                );\n                const height=clamp(\n                    Math.round(bounds.height*coverageScale),\n                    Number(sprite.minHeight)||160,\n                    maxHeight\n                );\n                node.dataset.targetIndexes=indexes.join(",");\n                node.dataset.areaId=bounds.id;\n                node.dataset.fixedFormation="true";\n                node.dataset.coverageScale=String(coverageScale);\n                node.style.left=(bounds.left+bounds.width/2)+"px";\n                node.style.top=(bounds.top+bounds.height/2)+"px";\n                node.style.width=width+"px";\n                node.style.height=height+"px";\n                node.style.clipPath="none";\n                node.style.setProperty("--v143-sprite-dx","0px");\n                node.style.setProperty("--v143-sprite-dy","0px");\n                node.style.setProperty("--v143-sprite-angle","0deg");\n                return;\n            }\n\n            /*\n               Optional target-bounds battlefield mode remains available for\n               skills that explicitly want a living-target footprint. Fixed\n               formation skills never enter this branch.\n            */\n            const targetCards=indexes.map(targetIndex=>cardFor(current.targetSide,targetIndex))'''
    text=replace_once(text,battlefield_marker,fixed_branch,"fixed battlefield branch")

    text=replace_once(
        text,
        '        const coverage=fieldBounds(coverageCards)||targetBounds;\n',
        '        const coverage=sprite.alignToSlots?targetBounds:(fieldBounds(coverageCards)||targetBounds);\n',
        "slot-aligned coverage"
    )
    text=replace_once(
        text,
        '        }else{\n            node.style.left=(coverage.left+coverage.width/2)+"px";\n            node.style.top=(coverage.top+coverage.height/2)+"px";\n            node.style.setProperty("--v143-sprite-dx","0px");',
        '        }else{\n            const centerX=sprite.alignToSlots&&Number.isFinite(targetBounds.centerX)\n                ?targetBounds.centerX:coverage.left+coverage.width/2;\n            const centerY=sprite.alignToSlots&&Number.isFinite(targetBounds.centerY)\n                ?targetBounds.centerY:coverage.top+coverage.height/2;\n            node.style.left=centerX+"px";\n            node.style.top=centerY+"px";\n            node.style.setProperty("--v143-sprite-dx","0px");',
        "slot-aligned center"
    )
    path.write_text(text)

    ice=Path("tests/v150-ice-arrow-rain-vfx.test.js")
    source=ice.read_text()
    source=replace_once(
        source,
        '    assert.equal(model.sprite.coverageScale,1.22);\n    assert.deepEqual([model.sprite.minWidth,model.sprite.minHeight],[140,140]);',
        '    assert.equal(model.sprite.fixedFormation,true);\n    assert.equal(model.sprite.targetBounds,undefined);\n    assert.equal(model.sprite.coverageScale,1.22);\n    assert.deepEqual([model.sprite.minWidth,model.sprite.minHeight],[140,140]);',
        "Ice Arrow Rain manifest assertions"
    )
    ice_pattern=re.compile(
        r'test\("one shared sheet uses the bounding box of living targets only",\(\)=>\{.*?\n\}\);\n\n(?=test\("all damage numbers)',
        re.S
    )
    match=ice_pattern.search(source)
    if not match:
        raise SystemExit("Ice Arrow Rain living-bounds test not found")
    replacement=r'''test("one shared sheet stays locked to the complete enemy formation after casualties",()=>{
    const placements=[];
    [[1],[0,1,2]].forEach(indexes=>{
        const runtime=loadRuntime(indexes);
        runtime.context.v142SkillAnimationDirector.play({
            id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",duration:1600,resolveDuration:1600
        },{side:"player",actorIndex:0});
        const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
        const sprites=stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"));
        assert.equal(sprites.length,1,indexes.join(","));
        const sprite=sprites[0];
        assert.equal(sprite.dataset.placement,"battlefield");
        assert.equal(sprite.dataset.targetSide,"monster");
        assert.equal(sprite.dataset.areaId,"battleMonsterArea");
        assert.equal(sprite.dataset.fixedFormation,"true");
        assert.equal(sprite.dataset.targetIndexes,indexes.join(","));
        assert.equal(sprite.style.left,"460px");
        assert.equal(sprite.style.top,"165px");
        assert.equal(sprite.style.clipPath||sprite.style["clip-path"],"none");
        assert.equal(sprite.dataset.renderer,"canvas-crop");
        assert.equal(sprite.style.backgroundImage,"none","the sheet is never a CSS background");
        assert.equal(sprite.querySelectorAll(".v166-water-battlefield-tile").length,0,"no tiled copies");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
        assert.ok(runtime.scheduled.some(timer=>timer.delay>=1590),"full 1.6 second action gate");
    });
    assert.deepEqual(placements[0],["460px","165px","537px","329px"]);
    assert.deepEqual(placements[1],placements[0],"one survivor and three survivors use the same full-formation footprint");
});

'''
    source=source[:match.start()]+replacement+source[match.end():]
    ice.write_text(source)

    wind=Path("tests/v173.23-wind-vfx.test.js")
    source=wind.read_text()
    marker='''test("enemy casts discover the real player target instead of using a fixed faction position",()=>{'''
    if marker not in source:
        raise SystemExit("wind insertion marker not found")
    wind_test=r'''test("three-target wind sheets keep a fixed three-slot footprint centered on the selected target",()=>{
    const placements=[];
    [
        [
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ],
        [
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ]
    ].forEach(monsters=>{
        const runtime=loadRuntime({monsters});
        runtime.context.v142SkillAnimationDirector.play(
            config("stormFlurry","tri","physical"),
            {side:"player",actorIndex:0}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        assert.equal(sprite.dataset.placement,"group");
        assert.equal(sprite.style.left,"458px","selected middle target remains the visual centre");
        assert.equal(sprite.style.top,"140px");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"casualties do not shrink or move the three-target sheet");
});

test("full-field wind sheets stay locked to the complete enemy area after casualties",()=>{
    const placements=[];
    [
        undefined,
        [
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ]
    ].forEach(monsters=>{
        const runtime=loadRuntime(monsters?{monsters}:{});
        runtime.context.v142SkillAnimationDirector.play(
            config("stormRain","all","magic"),
            {side:"player",actorIndex:0}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"full-field VFX does not follow survivor bounds");
});

'''
    source=source.replace(marker,wind_test+marker,1)
    wind.write_text(source)

    earth=Path("tests/v173.39-earth-light-vfx.test.js")
    source=earth.read_text()
    marker='''test("all seven persistent effects use 4x2 runtime cropping with the requested loop cadence",()=>{'''
    if marker not in source:
        raise SystemExit("earth insertion marker not found")
    earth_test=r'''test("earth trio sheets opt into fixed slot alignment and full-field earth stays formation-locked",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    ["petrifyFist","earthquakeCrush","stoneThrow","sandWind","earthShield","rockWall"].forEach(id=>{
        assert.equal(manifest[id].sprite.placement,"group",id);
        assert.equal(manifest[id].sprite.alignToSlots,true,id);
    });
    assert.equal(manifest.flyingSandStrike.sprite.placement,"battlefield");
    assert.equal(manifest.flyingSandStrike.sprite.targetBounds,undefined);
    assert.match(animation,/function fixedTriLayoutBounds\(current,indexes\)/);
    assert.match(animation,/const coverage=sprite\.alignToSlots\?targetBounds:/);
    assert.match(animation,/sprite\.alignToSlots&&Number\.isFinite\(targetBounds\.centerX\)/);
});

'''
    source=source.replace(marker,earth_test+marker,1)
    earth.write_text(source)


def record():
    path=Path("HANDOFF.md")
    text=path.read_text()
    section='''## V173.39 土／風範圍技能與冰霜箭雨 VFX 定位修正（目前 dev）\n\n- `js/39-v143-skill-animation.js` 繼續作為 Sprite VFX 幾何 owner，未新增 runtime patch。\n- 土／風 `tri`／`allyTri` 共用固定三站位視覺框：實際存活／命中數只決定傷害與狀態，不再參與 Sprite 尺寸；玩家選定的施放目標是固定視覺中心。\n- 土／風 `all`／`allyAll` battlefield 技能維持完整陣地幾何，死亡或剩餘人數不會縮小或把動畫拉向倖存者。\n- 水元素 `iceArrowRain`（冰霜箭雨）改為 `fixedFormation`：永遠使用完整 `battleMonsterArea` 作為敵方 10 人陣地範圍與中心，不再使用 `living-targets` 邊界。\n- 傷害、技能目標判定、狀態命中、SP、AI、角色資料與存檔規則均未修改。\n- 回歸測試覆蓋：風三人技 3→1 存活尺寸／中心不變、風全體技存活數變化不影響範圍、土三人 Sprite 全數固定站位、冰霜箭雨 3→1 存活仍保持完整敵方陣地尺寸與中心。\n\n'''
    marker='---\n\n'
    if section in text:
        return
    if marker not in text:
        raise SystemExit("HANDOFF insertion marker missing")
    path.write_text(text.replace(marker,marker+section,1))


if __name__=="__main__":
    mode=sys.argv[1] if len(sys.argv)>1 else "apply"
    if mode=="apply": apply()
    elif mode=="record": record()
    else: raise SystemExit("unknown mode")
