from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[2]


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)


def sub_once(text, pattern, repl, label):
    updated,count=re.subn(pattern,repl,text,count=1,flags=re.S)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return updated


def apply():
    main_path=ROOT/"css/00-main.css"
    main=main_path.read_text()

    main=sub_once(main,r'(\.home-hud-kicker\{[\s\S]*?\bgap:)7px;',r'\g<1>8px;',"HUD gap")
    main=sub_once(main,r'(\.home-hud-kicker\{[\s\S]*?\bfont-size:)10px;',r'\g<1>15px;',"HUD title font")

    main=sub_once(main,r'(\.home-utility-actions\{[\s\S]*?\bbottom:)5px;',r'\g<1>0;',"utility vertical position")
    main=sub_once(main,r'(\.home-utility-actions\{[\s\S]*?grid-template-columns:)repeat\(2,100px\);',r'\g<1>repeat(2,104px);',"utility columns")
    main=sub_once(main,r'(\.home-utility-actions\{[\s\S]*?\bpadding:)0 68px;',r'\g<1>0 68px;',"utility horizontal padding")

    main=sub_once(main,r'(\.home-card-utility\{[\s\S]*?grid-template-columns:)42px minmax\(0,1fr\);',r'\g<1>40px minmax(0,1fr);',"utility internal columns")
    main=sub_once(main,r'(\.home-card-utility\{[\s\S]*?\bheight:)47px;',r'\g<1>46px;',"utility height")

    main=sub_once(main,r'(\.home-card-utility \.home-card-icon\{[\s\S]*?\bwidth:)41px;',r'\g<1>40px;',"utility icon width")
    main=sub_once(main,r'(\.home-card-utility \.home-card-icon\{[\s\S]*?\bheight:)45px;',r'\g<1>40px;',"utility icon height")
    main=sub_once(main,r'(\.home-card-utility \.home-card-icon\{[\s\S]*?\bmargin-left:)1px;',r'\g<1>0;',"utility icon margin")

    main=sub_once(main,r'(\.home-card-utility \.home-card-label\{[\s\S]*?\bpadding:)0 4px;',r'\g<1>0;',"utility label padding")
    main=sub_once(main,r'(\.home-card-utility \.home-card-label\{[\s\S]*?\bfont-size:)12px;',r'\g<1>16px;',"utility label font")
    main=sub_once(main,r'(\.home-card-utility \.home-card-label\{[\s\S]*?\bline-height:)45px;',r'\g<1>44px;',"utility label line-height")
    main=sub_once(main,r'(\.home-card-utility \.home-card-label\{)([\s\S]*?\n\})',lambda m:m.group(1)+m.group(2).replace('\n}', '\n    letter-spacing:-.75px;\n}',1),"utility label letter spacing")
    main_path.write_text(main)

    index_path=ROOT/"index.html"
    index=index_path.read_text()
    index=sub_once(index,r'(#game-stage #homePage \.home-version-badge\{[\s\S]*?\bfont-size:)9px;',r'\g<1>11px;',"version font")
    index_path.write_text(index)

    roster_path=ROOT/"css/42-v146-system-polish.css"
    roster=roster_path.read_text()
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-roster\{[\s\S]*?\bmargin:)8px 10px 0;',r'\g<1>50px 10px 0;',"roster margin")
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-roster\{[\s\S]*?\bpadding:)3px 7px;',r'\g<1>4px 7px;',"roster padding")
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-roster > header\{[\s\S]*?\bmin-height:)14px;',r'\g<1>16px;',"roster header height")
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-roster > header\{[\s\S]*?\bline-height:)14px;',r'\g<1>16px;',"roster header line-height")
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-character\{[\s\S]*?\bheight:)46px;',r'\g<1>48px;',"roster row height")
    roster=sub_once(roster,r'(#game-stage #homePage \.v146-home-character\{[\s\S]*?\bpadding:)1px 7px 1px 2px;',r'\g<1>2px 7px 2px 2px;',"roster row padding")
    roster_path.write_text(roster)

    test_path=ROOT/"tests/v173.39-main-city-final-polish.test.js"
    test_path.write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const base=read("css/00-main.css"),index=read("index.html"),roster=read("css/42-v146-system-polish.css"),runtime=read("js/41-v146-system-polish.js");
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD uses the requested logical typography without growing its shell",()=>{
 assert.match(base,/\.home-city-hud\{[\s\S]*?min-height:48px;/);
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;/);
 assert.match(base,/\.home-hud-kicker\{[\s\S]*?gap:8px;[\s\S]*?font-size:15px;[\s\S]*?line-height:1\.15;/);
 assert.match(index,/#game-stage #homePage \.home-version-badge\{[\s\S]*?font-size:11px;/);
 assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});
test("utility buttons are 104x46 with 40px icons and a 52px centre corridor",()=>{
 assert.match(base,/\.home-utility-actions\{[\s\S]*?bottom:0;[\s\S]*?grid-template-columns:repeat\(2,104px\);[\s\S]*?padding:0 68px;/);
 assert.match(base,/\.home-card-utility\{[\s\S]*?grid-template-columns:40px minmax\(0,1fr\);[\s\S]*?height:46px;/);
 assert.match(base,/\.home-card-utility \.home-card-icon\{[\s\S]*?width:40px;[\s\S]*?height:40px;/);
 assert.match(base,/\.home-card-utility \.home-card-label\{[\s\S]*?font-size:16px;[\s\S]*?letter-spacing:-\.75px;/);
 assert.equal(396-(68*2)-(104*2),52);
});
test("roster shifts down exactly 42px and grows exactly 10px",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?margin:50px 10px 0;[\s\S]*?padding:4px 7px;/);
 assert.match(roster,/\.v146-home-roster > header\{[\s\S]*?min-height:16px;[\s\S]*?line-height:16px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?height:48px;[\s\S]*?padding:2px 7px 2px 2px;/);
 const oldHeight=2+6+14+6+(3*46),newHeight=2+8+16+6+(3*48);
 assert.equal(50-8,42);assert.equal(newHeight-oldHeight,10);assert.equal(newHeight,176);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
});
test("forbidden entry sizes and navigation remain untouched",()=>{
 assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);
 assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
 assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(3,82px\);/);
 assert.match(base,/#homePage\{[\s\S]{0,520}height:100%;[\s\S]{0,180}overflow:hidden/);
 assert.doesNotMatch(base,/\.home-card-utility\{[\s\S]*?transform:\s*scale/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");
''')

if __name__=="__main__":
    if len(sys.argv)!=2 or sys.argv[1]!="apply":
        raise SystemExit("usage: v17339-home-pixel-tune.py apply")
    apply()
