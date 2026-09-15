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


def ensure_after(path, anchor, block):
    p=Path(path)
    text=p.read_text()
    if block.strip() in text:
        return
    if anchor not in text:
        raise SystemExit(f'missing insert anchor in {path}: {anchor[:60]}')
    p.write_text(text.replace(anchor,anchor+'\n\n'+block,1))


# Bestiary / generic information rows: use separators and hierarchy instead of card-per-line chrome.
set_props('css/38-v141-system-expansion.css','#game-stage #homeFeatureModalBody .home-feature-row',{
    'min-height':'48px',
    'gap':'10px',
    'padding':'10px 4px',
    'border':'0',
    'border-bottom':'1px solid rgba(200,154,72,.14)',
    'border-radius':'0',
    'background':'transparent',
    'box-shadow':'none',
    'font-size':'15px',
    'line-height':'1.5'
})

# Quest keeps its dedicated list scroll owner and information-first structure.
set_props('css/25-stage-v90-quest-interface-core.css','#game-stage #homeFeatureModal.quest-mode .quest-tab',{
    'min-height':'44px !important'
})
set_props('css/25-stage-v90-quest-interface-core.css','#game-stage #homeFeatureModal.quest-mode .quest-card',{
    'padding':'10px 10px !important',
    'border':'1px solid rgba(200,154,72,.20) !important',
    'border-radius':'9px !important',
    'background':'linear-gradient(155deg,rgba(29,22,14,.66),rgba(9,7,5,.80)) !important',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.02) !important'
})
set_props('css/25-stage-v90-quest-interface-core.css','#game-stage #homeFeatureModal.quest-mode .quest-claim-btn',{
    'min-height':'44px !important',
    'border':'1px solid #a67836 !important',
    'background':'linear-gradient(180deg,#5d2417,#2c100a) !important'
})
set_props('css/25-stage-v90-quest-interface-core.css','#game-stage #homeFeatureModal.quest-mode .quest-completion-panel',{
    'border':'1px solid rgba(200,154,72,.22) !important',
    'background':'linear-gradient(180deg,rgba(26,19,12,.82),rgba(10,8,6,.88)) !important',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.02) !important'
})

# Shared RPG dialog: visual ornaments must never steal clicks; manager/runtime stays untouched.
set_props('css/49-v169-rpg-ui.css','.v169-rpg-dialog::before,\n.v169-rpg-dialog::after',{
    'pointer-events':'none'
})
set_props('css/49-v169-rpg-ui.css','.v169-rpg-dialog-crest',{
    'pointer-events':'none'
})
announcement_rule='''/* Premium functional UI: announcement is a reading surface, not a dashboard card. */
#game-stage #homeFeatureModal:not(:has(.home-feature-modal-box.wide)):has(#homeFeatureModalBody > div[style*="line-height:1.8"]):not(:has(#homeFeatureModalBody > button)) #homeFeatureModalBody > div[style*="line-height:1.8"]{
    max-width:34em;
    margin:0 auto;
    padding:4px 3px 16px;
    color:#ded1b8;
    font-size:15px !important;
    line-height:1.8 !important;
    letter-spacing:.015em;
    overflow-wrap:anywhere;
}
#game-stage .home-feature-modal-box::before,
#game-stage .home-feature-modal-box::after{
    pointer-events:none;
}'''
ensure_after('css/49-v169-rpg-ui.css','''.v169-rpg-dialog-button:focus-visible{
    outline:2px solid #fff0b3;
    outline-offset:2px;
}''',announcement_rule)

# Final visible QA owner for achievements and late quest typography/geometry.
qa='css/53-v173.51-qa.css'
set_props(qa,'#game-stage #homeFeatureModal .v17351-achievement-toolbar',{
    'flex':'0 0 44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal .v17351-achievement-claim-all',{
    'min-height':'44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal .v17351-achievement-card',{
    'border':'1px solid rgba(200,154,72,.22)!important',
    'background':'linear-gradient(150deg,rgba(31,23,14,.76),rgba(9,7,5,.90))!important',
    'box-shadow':'inset 0 1px 0 rgba(255,238,196,.02)!important'
})
set_props(qa,'#game-stage #homeFeatureModal .v17351-achievement-card>button',{
    'min-height':'44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal .v17351-achievement-pager',{
    'flex':'0 0 44px!important'
})
set_props(qa,'.v17351-achievement-pager button',{
    'height':'44px!important',
    'min-height':'44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.quest-mode .quest-tab',{
    'min-height':'44px!important'
})
set_props(qa,'#game-stage #homeFeatureModal.quest-mode .quest-claim-btn',{
    'min-height':'44px!important'
})

Path('tests/premium-functional-ui-batch5.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const main=read("js/00-main.js");
const core=read("js/34-v141-core-systems.js");
const ui=read("js/35-v141-ui-battle.js");
const rpg=read("js/51-v169-rpg-ui.js");
const questRuntime=read("js/57-v173.51-quest-qa.js");
const saves=read("js/startup/account-save-repository.js");
const shared=read("css/49-v169-rpg-ui.css");
const info=read("css/38-v141-system-expansion.css");
const quest=read("css/25-stage-v90-quest-interface-core.css");
const qa=read("css/53-v173.51-qa.css");
assert.match(main,/function renderBestiaryContent\(\)/);
assert.match(main,/bestiaryData/);
assert.match(main,/achievementState/);
assert.match(main,/type==="bestiary"/);
assert.match(main,/type==="announcement"/);
assert.match(ui,/ANNOUNCEMENT_READ_KEY=window\.FourSymbolsAccountSave\.accountKey\("announcement-read"\)/);
assert.match(saves,/v141_announcement_read:"announcement-read"/);
assert.match(core,/achievement/);
assert.match(questRuntime,/quest/);
assert.match(rpg,/window\.rpgAlert=function/);
assert.match(rpg,/window\.rpgConfirm=function/);
assert.match(rpg,/event\.key!=="Escape"/);
assert.match(rpg,/previousFocus/);
assert.match(shared,/\.v169-rpg-dialog::before,[\s\S]*?pointer-events:none/);
assert.match(shared,/\.v169-rpg-dialog-crest\{[\s\S]*?pointer-events:none/);
assert.match(shared,/announcement is a reading surface/);
assert.match(shared,/home-feature-modal-box::before,[\s\S]*?pointer-events:none/);
assert.match(info,/#homeFeatureModalBody \.home-feature-row\{[\s\S]*?border-bottom:1px solid rgba\(200,154,72,.14\)[\s\S]*?background:transparent/);
assert.match(quest,/quest-tab\{[\s\S]*?min-height:44px !important/);
assert.match(quest,/quest-tab-body\{[\s\S]*?overflow-y:auto[\s\S]*?touch-action:pan-y/);
assert.match(quest,/quest-claim-btn\{[\s\S]*?min-height:44px !important/);
assert.match(qa,/v17351-achievement-claim-all\{[^{}]*min-height:44px!important/);
assert.match(qa,/v17351-achievement-card>button\{[^{}]*min-height:44px!important/);
assert.match(qa,/v17351-achievement-pager button\{[^{}]*min-height:44px!important/);
assert.match(qa,/quest-mode \.quest-tab\{[^{}]*min-height:44px!important/);
assert.match(qa,/quest-mode \.quest-claim-btn\{[^{}]*min-height:44px!important/);
console.log("✓ premium functional UI batch 5 preserves achievement, announcement, bestiary, quest and modal runtimes");
''')
