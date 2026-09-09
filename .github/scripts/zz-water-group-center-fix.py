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
print("Water/group tri Sprite centering patch staged.")
