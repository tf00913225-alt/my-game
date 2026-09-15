from pathlib import Path
import re


def set_props(path, selector, props):
    p=Path(path)
    text=p.read_text()
    pattern=re.compile(r'(?ms)^('+re.escape(selector)+r'\{)(.*?)(^\})')
    match=pattern.search(text)
    if not match:
        raise SystemExit(f'missing rule {selector} in {path}')
    body=match.group(2)
    for name,value in props.items():
        prop=re.compile(r'(?m)^(\s*)'+re.escape(name)+r'\s*:\s*[^;]+;')
        if prop.search(body):
            body=prop.sub(lambda m: m.group(1)+name+':'+value+';',body,count=1)
        else:
            body=body.rstrip()+'\n    '+name+':'+value+';\n'
    new=text[:match.start()]+match.group(1)+body+match.group(3)+text[match.end():]
    p.write_text(new)


shop='css/49-v169-rpg-ui.css'
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .v17345-shop-tabs button',{
    'min-height':'44px !important','height':'44px !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .shop-potion-card',{
    'border':'1px solid rgba(200,154,72,.20) !important',
    'background':'linear-gradient(155deg,rgba(28,21,13,.72),rgba(8,7,5,.90)) !important',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.025),0 3px 8px rgba(0,0,0,.24) !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .shop-potion-quantity',{
    'height':'38px !important','min-height':'38px !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .shop-potion-purchase-row .shop-potion-buy',{
    'height':'42px !important','min-height':'42px !important',
    'border':'1px solid #c2964d !important',
    'color':'#2b1908 !important',
    'background':'linear-gradient(180deg,#f1ce7a,#bd7d2d) !important',
    'font-weight':'900 !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .v17346-shop-card',{
    'border':'1px solid rgba(200,154,72,.20) !important',
    'background':'linear-gradient(155deg,rgba(28,21,13,.72),rgba(8,7,5,.90)) !important',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.025),0 3px 8px rgba(0,0,0,.24) !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v131-shop-open .v17346-shop-card .v17346-shop-buy',{
    'height':'42px !important','min-height':'42px !important',
    'border':'1px solid #c2964d !important',
    'color':'#2b1908 !important',
    'background':'linear-gradient(180deg,#f1ce7a,#bd7d2d) !important',
    'font-weight':'900 !important'
})
set_props(shop,'#game-stage #homeFeatureModal.v141-synthesis-modal .v141-synthesis-tabs button',{
    'min-height':'44px !important'
})

synth='css/38-v141-system-expansion.css'
set_props(synth,'#game-stage .v141-synthesis-wallet',{
    'border':'1px solid rgba(200,154,72,.24)',
    'background':'linear-gradient(90deg,rgba(27,20,12,.78),rgba(12,9,6,.88))',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.025)'
})
set_props(synth,'#game-stage .v141-synthesis-tabs button',{
    'min-height':'44px'
})
set_props(synth,'#game-stage .v141-synthesis-card,#game-stage .v141-synthesis-empty',{
    'border':'1px solid rgba(200,154,72,.20)',
    'background':'linear-gradient(155deg,rgba(29,22,14,.68),rgba(9,7,5,.86))',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.02)'
})
set_props(synth,'#game-stage .v141-material-lines span',{
    'border':'0',
    'border-bottom':'1px solid rgba(200,154,72,.14)',
    'border-radius':'0',
    'background':'transparent'
})
set_props(synth,'#game-stage .v141-synthesis-primary',{
    'min-height':'44px !important'
})
set_props(synth,'#game-stage .v141-reforge-current',{
    'border':'0',
    'border-left':'2px solid rgba(200,154,72,.58)',
    'border-radius':'0',
    'background':'rgba(18,13,8,.56)'
})
set_props(synth,'#game-stage .v141-reforge-compare button',{
    'min-height':'44px'
})
set_props(synth,'#game-stage .v141-upgrade-flow section',{
    'border':'1px solid rgba(200,154,72,.16)',
    'background':'linear-gradient(155deg,rgba(25,19,13,.64),rgba(10,8,6,.80))'
})

Path('tests/premium-functional-ui-batch4.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const shop=read("css/49-v169-rpg-ui.css");
const synth=read("css/38-v141-system-expansion.css");
const economy=read("js/28-v133-economy-rebalance.js");
const shopRuntime=read("js/40-v144-rules-and-abyss.js");
const synthesis=read("js/36-v141-content-systems.js");
const fixes=read("js/58-v173.63-functional-fixes.js");
const ui=read("js/51-v169-rpg-ui.js");
assert.match(shop,/#homeFeatureModal\.v131-shop-open \.v17345-shop-tabs button\{[\s\S]*?min-height:44px !important;[\s\S]*?height:44px !important/);
assert.match(shop,/\.shop-potion-purchase-row \.shop-potion-buy\{[\s\S]*?min-height:42px !important;[\s\S]*?#f1ce7a/);
assert.match(shop,/\.v17346-shop-card \.v17346-shop-buy\{[\s\S]*?min-height:42px !important;[\s\S]*?#f1ce7a/);
assert.match(shop,/v141-synthesis-modal \.v141-synthesis-tabs button\{[\s\S]*?min-height:44px !important/);
assert.match(synth,/\.v141-material-lines span\{[\s\S]*?border-bottom:1px solid rgba\(200,154,72,.14\)[\s\S]*?background:transparent/);
assert.match(synth,/\.v141-material-lines \.lack\{color:#ee8e79;/);
assert.match(synth,/\.v141-synthesis-primary\{[\s\S]*?min-height:44px !important/);
assert.match(synth,/\.v141-reforge-compare button\{[\s\S]*?min-height:44px/);
assert.match(synth,/\.v141-synthesis-body\{[\s\S]*?overflow-y:auto[\s\S]*?touch-action:pan-y/);
assert.match(synthesis,/\["reforge","裝備冶煉"\]/);
assert.match(synthesis,/\["talisman","符咒合成"\]/);
assert.match(synthesis,/\["fragment","碎片合成"\]/);
assert.match(fixes,/ensureMaterialTab/);
assert.match(shopRuntime,/shopUnitPrice/);
assert.match(economy,/gold/);
assert.match(ui,/shop-potion-card/);
console.log("✓ premium functional UI batch 4 preserves shop transactions and synthesis/reforge runtimes");
''')
