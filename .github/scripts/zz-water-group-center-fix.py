from pathlib import Path

path = Path("js/39-v143-skill-animation.js")
text = path.read_text()

old = '''        const anchor=Number.isInteger(center)?cardCenter(cardFor(current.targetSide,center)):null;
        if(!anchor){
            const area=sideAreaBounds(current.targetSide);
            if(area){
                area.centerX=area.left+area.width/2;
                area.centerY=area.top+area.height/2;
            }
            return area;
        }
        let step=Math.max(1,anchor.rect.width+3);'''

new = '''        const anchor=Number.isInteger(center)?cardCenter(cardFor(current.targetSide,center)):null;
        if(!anchor){
            const area=sideAreaBounds(current.targetSide);
            if(area){
                area.centerX=area.left+area.width/2;
                area.centerY=area.top+area.height/2;
            }
            return area;
        }
        /* Explicit resolved targets are authoritative for VFX centering.  A queued
           tri target can point at the first surviving slot (for example 0 while
           the real hit set is [0,2]); keeping that slot as the visual center
           shifts a group Sprite off the actual targets.  Preserve the fixed tri
           coverage width below, but center it on the resolved target geometry. */
        const explicitBounds=Array.isArray(current.targetIds)&&current.targetIds.length
            ?fieldBounds(indexes.map(i=>cardFor(current.targetSide,i)).filter(Boolean))
            :null;
        const layoutCenterX=explicitBounds?explicitBounds.left+explicitBounds.width/2:anchor.x;
        const layoutCenterY=explicitBounds?explicitBounds.top+explicitBounds.height/2:anchor.y;
        let step=Math.max(1,anchor.rect.width+3);'''

if old not in text:
    raise SystemExit("fixedTriLayoutBounds anchor block not found")
text = text.replace(old, new, 1)

old_return = '''        const width=anchor.rect.width+step*2;
        return {
            left:anchor.x-width/2,top:anchor.rect.top,width:width,height:anchor.rect.height,
            centerX:anchor.x,centerY:anchor.y,id:"fixed-tri-slots"
        };'''
new_return = '''        const width=anchor.rect.width+step*2;
        return {
            left:layoutCenterX-width/2,top:anchor.rect.top,width:width,height:anchor.rect.height,
            centerX:layoutCenterX,centerY:layoutCenterY,id:"fixed-tri-slots"
        };'''
if old_return not in text:
    raise SystemExit("fixedTriLayoutBounds return block not found")
text = text.replace(old_return, new_return, 1)
path.write_text(text)

# Migrate the remaining V166 renderer-specific assertions to the shared V143 raster owner.
test_path = Path("tests/v166-water-vfx.test.js")
test_text = test_path.read_text()
old_keyframe = '    assert.match(css,/@keyframes v166WaterTargetTravel\\{/);'
new_keyframe = '''    assert.match(css,/@keyframes v143RasterTravel\\{/);
    assert.doesNotMatch(css,/v166WaterTargetTravel/);'''
if old_keyframe not in test_text:
    raise SystemExit("V166 Water target travel assertion not found")
test_text = test_text.replace(old_keyframe, new_keyframe, 1)

old_enemy = '''    assert.equal(sprites[0].style["--v143-sprite-target-left"],"379px");
    assert.equal(sprites[0].style["--v143-sprite-target-top"],"418px");'''
new_enemy = '''    assert.equal(sprites[0].dataset.travel,"true");
    assert.equal(sprites[0].style.left,"338px");
    assert.equal(sprites[0].style.top,"140px");
    assert.equal(sprites[0].style["--v143-sprite-dx"],"41px");
    assert.equal(sprites[0].style["--v143-sprite-dy"],"278px");'''
if old_enemy not in test_text:
    raise SystemExit("V166 enemy Tidal Beast legacy target coordinates not found")
test_text = test_text.replace(old_enemy, new_enemy, 1)
test_path.write_text(test_text)

print("Water/group tri Sprite centering and V166 raster contract migration staged.")
