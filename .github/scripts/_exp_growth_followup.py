from pathlib import Path

path=Path("tests/v139-economy-rested-exp.test.js")
text=path.read_text(encoding="utf-8")
old=r'''/if\(isElementBoxBattle\)\{[\s\S]*?finalExp=Math\.round\(finalExp\*ELEMENT_BOX_EXP_RATIO\);[\s\S]*?\}else if\(typeof window\.v139TryConsumeRestedBattle==="function"\)/'''
new=r'''/if\(isElementBoxBattle\)\{[\s\S]*?finalExp=applyPatrolExpMode\(finalExp,\{elementBox:true\}\);[\s\S]*?\}else if\(typeof window\.v139TryConsumeRestedBattle==="function"\)/'''
if text.count(old)!=1:
    raise SystemExit(f"expected one element-box/rested source assertion, got {text.count(old)}")
path.write_text(text.replace(old,new,1),encoding="utf-8")
print("EXP follow-up source regression updated")
