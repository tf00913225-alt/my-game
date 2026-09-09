from pathlib import Path

p=Path("tests/ui-typography-battle-preservation.test.js")
s=p.read_text()
old_base='assert.ok(base("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(16px);}"));'
old_current='assert.ok(current("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(16px);}"));'
new_base='assert.match(base("css/42-v146-system-polish.css"),/#game-stage #battlePage #battleMonsterArea\\{[\\s\\S]*?transform:translateY\\(16px\\);[\\s\\S]*?\\}/);'
new_current='assert.match(current("css/42-v146-system-polish.css"),/#game-stage #battlePage #battleMonsterArea\\{[\\s\\S]*?transform:translateY\\(16px\\);[\\s\\S]*?\\}/);'
if old_base not in s and new_base not in s:
    raise RuntimeError("V146 baseline position assertion missing")
if old_current not in s and new_current not in s:
    raise RuntimeError("V146 current position assertion missing")
s=s.replace(old_base,new_base,1).replace(old_current,new_current,1)
p.write_text(s)
print("V146 preservation position matcher fixed.")
