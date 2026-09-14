import subprocess
import re
from pathlib import Path

OLD_WORKFLOW_COMMIT = "d2a9f08b773bccff0af712d0e904599f62f448f0"
OLD_WORKFLOW_PATH = ".github/workflows/temp-shared-nav-vfx-battle-layout.yml"

old = subprocess.check_output(
    ["git", "show", f"{OLD_WORKFLOW_COMMIT}:{OLD_WORKFLOW_PATH}"],
    text=True,
)
marker = "          python - <<'PY'\n"
start = old.index(marker) + len(marker)
end = old.index("\n          PY", start)
raw = old[start:end]
code = "\n".join(
    line[10:] if line.startswith("          ") else line
    for line in raw.splitlines()
)

# Make the original replace helper tolerant of the current VFX assignment formatting.
original = (
    "def replace_once(path, old, new):\n"
    "    text=read(path)\n"
    "    assert text.count(old)==1, f'{path}: expected exactly one occurrence of {old[:80]!r}, got {text.count(old)}'\n"
    "    write(path,text.replace(old,new,1))"
)
tolerant = (
    "def replace_once(path, old, new):\n"
    "    text=read(path)\n"
    "    count=text.count(old)\n"
    "    if count==0 and path=='js/39-v143-skill-animation.js' and 'node.dataset.frames=String(sprite.frames);' in old:\n"
    "        pattern=r'            node\\.dataset\\.frames=String\\(sprite\\.frames\\);\\n            node\\.style\\.backgroundImage=.*?\\n            node\\.style\\.backgroundSize=.*?\\n            node\\.style\\.setProperty\\(\"--v143-sprite-duration\",current\\.duration\\+\"ms\"\\);'\n"
    "        patched,n=re.subn(pattern,new,text,count=1,flags=re.S)\n"
    "        assert n==1, f'{path}: flexible VFX assignment match failed'\n"
    "        write(path,patched)\n"
    "        return\n"
    "    assert count==1, f'{path}: expected exactly one occurrence of {old[:80]!r}, got {count}'\n"
    "    write(path,text.replace(old,new,1))"
)
assert original in code
code = code.replace(original, tolerant, 1)

# The embedded workflow lost indentation inside one triple-quoted matcher. Restore it.
bad_old = (
    "old='''            node.style.setProperty(\"font-size\",\"13px\",\"important\");\n"
    "  const available=Math.max(1,node.clientWidth||68);\n"
    "  let size=13;\n"
    "  while(size>11&&node.scrollWidth>available){'''"
)
good_old = (
    "old='''            node.style.setProperty(\"font-size\",\"13px\",\"important\");\n"
    "            const available=Math.max(1,node.clientWidth||68);\n"
    "            let size=13;\n"
    "            while(size>11&&node.scrollWidth>available){'''"
)
bad_new = (
    "new='''            node.style.setProperty(\"font-size\",\"9px\",\"important\");\n"
    "  const available=Math.max(1,node.clientWidth||68);\n"
    "  let size=9;\n"
    "  while(size>8&&node.scrollWidth>available){'''"
)
good_new = (
    "new='''            node.style.setProperty(\"font-size\",\"9px\",\"important\");\n"
    "            const available=Math.max(1,node.clientWidth||68);\n"
    "            let size=9;\n"
    "            while(size>8&&node.scrollWidth>available){'''"
)
assert bad_old in code
assert bad_new in code
code = code.replace(bad_old, good_old, 1)
code = code.replace(bad_new, good_new, 1)

# Current V173.51 name rule has the same semantics but a slightly different property
# order than the original repair matcher. Normalize only this owner block so the
# original owner-level patch can apply deterministically.
battle_path = Path("js/54-v173.51-battle-qa.js")
battle = battle_path.read_text(encoding="utf-8")
pattern = re.compile(
    r'#game-stage > #app > #game-content #battlePage \.battle-monster\.v174-cardless-unit>\.battle-monster-name\{.*?\n\}\n'
    r'#game-stage > #app > #game-content #battlePage \.battle-monster\.v174-cardless-unit>\.v174-battle-art\{.*?\n\}',
    re.S,
)
normalized = '''#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.battle-monster-name{
    position:absolute!important;left:0!important;right:0!important;top:0!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    min-height:14px!important;height:14px!important;margin:0!important;padding:0 2px!important;
    white-space:nowrap!important;overflow:visible!important;visibility:visible!important;opacity:1!important;
    z-index:24!important;pointer-events:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.v174-battle-art{
    inset:15px -5px 26px!important;
    background-size:cover!important;background-position:center center!important;
}'''
battle, count = pattern.subn(normalized, battle, count=1)
assert count == 1, "battle monster identity/art owner block not found"
battle_path.write_text(battle, encoding="utf-8")

exec(compile(code, "temp-shared-nav-vfx-battle-layout.py", "exec"))

# V148's own historical test must now assert the final shared context-nav owner,
# not the retired dungeon-only matcher.
test_path = Path("tests/v148-combat-dungeon-fixes.test.js")
test_text = test_path.read_text(encoding="utf-8")
old_assert = r'assert.match(source,/function dungeonNavMatches\(nav,abyssMapActive,abyssSelectionActive\)/);'
new_assert = r'assert.match(source,/function contextNavMatches\(nav,returnAction\)/);'
assert old_assert in test_text, "v148 historical nav matcher assertion not found"
test_path.write_text(test_text.replace(old_assert, new_assert, 1), encoding="utf-8")
