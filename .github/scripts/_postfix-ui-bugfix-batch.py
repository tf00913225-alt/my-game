from pathlib import Path
import re

path=Path("js/58-v173.63-functional-fixes.js")
text=path.read_text(encoding="utf-8")
pattern=r'''onclick="v17363ChooseMaterialOption\(''\+esc\(key\)\+'',''\+esc\(choice\.value\)\+''\)"'''
replacement='data-material-key="'+"'"+'+esc(key)+'+"'"+'" data-material-value="'+"'"+'+esc(choice.value)+'+"'"+'" onclick="v17363ChooseMaterialOption(this.dataset.materialKey,this.dataset.materialValue)"'
text,count=re.subn(pattern,replacement,text,count=1)
if count!=1:
    raise SystemExit(f"material picker quoting postfix replacement count={count}")
for kind in ("ore","blueprint"):
    old=f'onclick="v17363CraftMaterial(\'{kind}\')"'
    new=f'onclick="v17363CraftMaterial(&quot;{kind}&quot;)"'
    if old not in text:
        raise SystemExit(f"material craft quoting target missing: {kind}")
    text=text.replace(old,new,1)
path.write_text(text,encoding="utf-8")
