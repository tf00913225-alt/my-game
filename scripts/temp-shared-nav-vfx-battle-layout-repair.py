import subprocess

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

# The embedded workflow lost indentation inside one triple-quoted matcher. Restore
# the indentation in the generated Python source before executing it.
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

exec(compile(code, "temp-shared-nav-vfx-battle-layout.py", "exec"))
