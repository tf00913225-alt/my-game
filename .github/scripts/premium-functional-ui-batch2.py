from pathlib import Path
import re


def replace_rule(path, selector, body):
    p=Path(path)
    text=p.read_text()
    pattern=re.compile(r'(?ms)^'+re.escape(selector)+r'\{.*?\}')
    replacement=selector+'{\n'+body.rstrip()+'\n}'
    new,count=pattern.subn(replacement,text,count=1)
    if count!=1:
        raise SystemExit(f'expected exactly one rule for {selector} in {path}, got {count}')
    p.write_text(new)


replace_rule('css/00-main.css','.status-row','''    display:flex;
    align-items:center;
    justify-content:space-between;
    min-height:52px;
    margin:0;
    padding:4px 0;
    border-bottom:1px solid rgba(200,154,72,.14);
    font-size:13px;
    gap:8px;''')
replace_rule('css/00-main.css','.status-btn','''    width:44px;
    height:44px;
    flex:0 0 44px;
    border:1px solid rgba(200,154,72,.38);
    border-radius:9px;
    background:linear-gradient(180deg,#2b2419,#14110d);
    color:#ead9b4;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.04);
    font-size:20px;
    font-weight:900;
    -webkit-tap-highlight-color:transparent;
    -webkit-touch-callout:none;
    user-select:none;''')
replace_rule('css/00-main.css','.status-points-line','''    margin:10px 0 6px;
    padding:8px 10px;
    border-left:2px solid #c89a48;
    background:rgba(18,13,8,.58);
    color:#d8c7a6;
    font-size:12px;
    line-height:1.45;''')
replace_rule('css/00-main.css','.status-confirm','''    width:100%;
    min-height:44px;
    margin-top:8px;
    padding:8px 12px;
    border:1px solid #c89a48;
    border-radius:9px;
    background:linear-gradient(180deg,#5a401f,#28180c);
    color:#fff0c2;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.06);
    font-weight:900;
    font-size:14px;''')
replace_rule('css/00-main.css','.skill-loadout-slot','''    min-height:60px;
    padding:6px 4px;
    background:radial-gradient(circle at 50% 28%,rgba(200,154,72,.10),transparent 44%),#100d09;
    border:1px solid rgba(200,154,72,.30);
    border-radius:9px;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.03);
    font-size:10px;
    text-align:center;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:4px;''')
replace_rule('css/00-main.css','.skill-row','''    display:flex;
    align-items:stretch;
    gap:8px;
    min-height:60px;
    padding:8px 7px;
    background:linear-gradient(145deg,rgba(29,22,14,.72),rgba(10,8,6,.82));
    border:1px solid rgba(200,154,72,.18);
    border-radius:9px;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.025);
    font-size:11px;
    line-height:1.5;''')
replace_rule('css/00-main.css','.skill-action-card','''    flex:0 0 48px;
    width:48px;
    min-height:44px;
    display:flex;
    flex-direction:column;
    border-radius:7px;
    overflow:hidden;
    border:1px solid rgba(200,154,72,.38);
    background:#100d09;
    cursor:pointer;
    -webkit-tap-highlight-color:transparent;''')

replace_rule('css/31-v131-fix-batch.css','.v131-exp-row','''    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    gap:5px 8px;
    align-items:center;
    padding:10px 10px 9px;
    border:1px solid rgba(200,154,72,.24);
    border-radius:9px;
    background:linear-gradient(145deg,rgba(29,22,14,.76),rgba(10,8,6,.86));
    box-shadow:inset 0 1px 0 rgba(255,238,196,.025);''')
replace_rule('css/31-v131-fix-batch.css','.v131-exp-preview-btn','''    grid-column:1 / -1;
    width:100%;
    min-height:44px;
    padding:8px 10px;
    border:1px solid rgba(200,154,72,.42);
    border-radius:8px;
    background:linear-gradient(180deg,#2b2419,#14110d);
    color:#e7d7b5;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.035);
    font-size:15px;
    font-weight:900;''')
replace_rule('css/31-v131-fix-batch.css','.v131-exp-actions button','''    min-height:44px;
    padding:9px 8px;
    border:1px solid #a77a35;
    border-radius:8px;
    font-size:15px;
    font-weight:900;''')

replace_rule('css/38-v141-system-expansion.css','#game-stage #homeExpPoolCard .exp-pool-hero','''    position:relative;
    padding:12px 13px 11px;
    border:1px solid rgba(200,154,72,.30);
    border-radius:11px;
    background:linear-gradient(155deg,rgba(35,26,16,.90),rgba(10,8,6,.93));
    box-shadow:inset 0 1px 0 rgba(255,238,196,.035);''')
replace_rule('css/38-v141-system-expansion.css','#game-stage #homeExpPoolCard .exp-pool-section-head','''    margin:10px 3px 6px;
    padding-bottom:6px;
    border-bottom:1px solid rgba(200,154,72,.16);''')

Path('tests/premium-functional-ui-batch2.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const html=read("index.html");
const main=read("js/00-main.js");
const growth=read("js/41-v146-system-polish.js");
const base=read("css/00-main.css");
const exp=read("css/31-v131-fix-batch.css");
const expShell=read("css/38-v141-system-expansion.css");
assert.match(html,/id="expDistributeList"/);
assert.match(html,/id="attributePoints"/);
assert.match(html,/id="confirmStatusButton"[\s\S]*?onclick="confirmStatus\(\)"/);
assert.match(main,/function renderExpDistributeList\(\)/);
assert.match(main,/function addPoint\(/);
assert.match(main,/function removePoint\(/);
assert.match(main,/function confirmStatus\(\)/);
["attack","intelligence","vitality","energy","spirit","agility"].forEach(stat=>assert.match(main,new RegExp(stat)));
assert.match(growth,/characterTabBtnExpPool/);
assert.match(growth,/characterTabBtnStatus/);
assert.match(growth,/characterTabBtnSkill/);
assert.match(growth,/homeExpPoolCard/);
assert.match(growth,/statusPage/);
assert.match(growth,/skillPage/);
assert.match(base,/\.status-btn\{[\s\S]*?width:44px;[\s\S]*?height:44px/);
assert.match(base,/\.status-confirm\{[\s\S]*?min-height:44px/);
assert.match(base,/\.skill-action-card\{[\s\S]*?min-height:44px/);
assert.match(exp,/\.v131-exp-preview-btn\{[\s\S]*?min-height:44px/);
assert.match(exp,/\.v131-exp-actions button\{[\s\S]*?min-height:44px/);
assert.match(expShell,/#game-stage #homeExpPoolCard \.exp-pool-hero\{[\s\S]*?rgba\(200,154,72,.30\)/);
console.log("✓ premium functional UI batch 2 preserves EXP, leveling, six-stat allocation and skill owners");
''')
