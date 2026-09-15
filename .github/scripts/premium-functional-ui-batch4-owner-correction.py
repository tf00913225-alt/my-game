from pathlib import Path
import re


def set_props(path, selector, props):
    p=Path(path)
    text=p.read_text()
    pattern=re.compile(r'('+re.escape(selector)+r'\{)([^{}]*)(\})',re.S)
    match=pattern.search(text)
    if not match:
        raise SystemExit(f'missing rule {selector} in {path}')
    body=match.group(2)
    for name,value in props.items():
        prop=re.compile(r'(^|[;\n])(\s*)'+re.escape(name)+r'\s*:\s*[^;]+;',re.M)
        if prop.search(body):
            body=prop.sub(lambda m:m.group(1)+m.group(2)+name+':'+value+';',body,count=1)
        else:
            body=body.rstrip()+'\n    '+name+':'+value+';\n'
    p.write_text(text[:match.start()]+match.group(1)+body+match.group(3)+text[match.end():])


qa='css/53-v173.51-qa.css'
set_props(qa,'#game-stage #homeFeatureModal.v131-shop-open .v17346-shop-card .v17346-shop-buy',{
    'height':'42px!important','min-height':'42px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.v131-shop-open .v17345-equipment-refresh>button',{
    'height':'44px!important','min-height':'44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.v131-shop-open .shop-potion-quantity',{
    'height':'38px!important','min-height':'38px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.v131-shop-open .shop-potion-purchase-row .shop-potion-buy',{
    'height':'42px!important','min-height':'42px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.v141-synthesis-modal .v141-synthesis-tabs button',{
    'min-height':'44px!important'
})

p=Path('tests/premium-functional-ui-batch4.test.js')
text=p.read_text()
needle='const ui=read("js/51-v169-rpg-ui.js");\n'
if needle not in text:
    raise SystemExit('missing Batch 4 test anchor')
insert='const qa=read("css/53-v173.51-qa.css");\n'
if insert not in text:
    text=text.replace(needle,needle+insert)
checks='''assert.match(qa,/v17346-shop-card \\.v17346-shop-buy\\{[^{}]*min-height:42px!important/);\nassert.match(qa,/v17345-equipment-refresh>button\\{[^{}]*min-height:44px!important/);\nassert.match(qa,/shop-potion-quantity\\{[^{}]*min-height:38px!important/);\nassert.match(qa,/shop-potion-purchase-row \\.shop-potion-buy\\{[^{}]*min-height:42px!important/);\nassert.match(qa,/v141-synthesis-modal \\.v141-synthesis-tabs button\\{[^{}]*min-height:44px!important/);\n'''
anchor='assert.match(synthesis,/\\["reforge","裝備冶煉"\\]/);\n'
if checks not in text:
    text=text.replace(anchor,checks+anchor)
p.write_text(text)
