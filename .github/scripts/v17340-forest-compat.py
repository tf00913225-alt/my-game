from pathlib import Path
import re
import subprocess

BASE='45ebf0ce301195f689a258a87aa045baf450b2c3'
RELEASE='173.40'
PREVIOUS='173.39'
RELEASE_ENTRIES=[
    'css/00-main.css',
    'css/19-stage-v54-main-city-moderate-native-scale.css',
    'js/00-main.js',
    'js/16-stage-v54-main-city-runtime.js',
    'js/19-stage-v78-character-inventory-runtime.js',
    'js/20-anonymous-20.js'
]


def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)


def base_file(path):
    return subprocess.check_output(
        ['git','show',f'{BASE}:{path}'],
        text=True
    )

# Keep the canonical forest array shape used by the economy/audit owners, then
# apply the newcomer-only metadata immediately after construction.
p=Path('js/00-main.js')
s=p.read_text()
helper='''function makeBeginnerForestMonster(name,level,element){\n    const monster=makeZoneMonster(name,level,element);\n    monster.agilityPoints=0;\n    monster.agility=0;\n    monster.v173BeginnerForest=true;\n    return monster;\n}\n\n'''
s=once(s,helper,'','remove temporary forest constructor')
if s.count('makeBeginnerForestMonster(')!=6:
    raise SystemExit('expected six beginner forest constructor calls')
s=s.replace('makeBeginnerForestMonster(','makeZoneMonster(')
anchor='''    makeZoneMonster("史萊姆",2,"water")\n\n];\n\n\n/*\n   ★ 荒漠地帶'''
replacement='''    makeZoneMonster("史萊姆",2,"water")\n\n];\n\nforestMonsters.forEach(monster=>{\n    monster.agilityPoints=0;\n    monster.agility=0;\n    monster.v173BeginnerForest=true;\n});\n\n\n/*\n   ★ 荒漠地帶'''
s=once(s,anchor,replacement,'forest post configuration')
p.write_text(s)

# Rebuild index versioning from the exact pre-V173.40 production surface.
# Only CI's six authoritative release entries move with the release cache;
# all unrelated stage/VFX assets retain their own historical cache keys.
index=base_file('index.html')
index=index.replace(f'<title>四象江湖傳 V{PREVIOUS}</title>',f'<title>四象江湖傳 V{RELEASE}</title>')
index=index.replace(f'id="v{PREVIOUS}-home-version-badge-style"',f'id="v{RELEASE}-home-version-badge-style"')
index=index.replace(f'aria-label="目前版本 V{PREVIOUS}"',f'aria-label="目前版本 V{RELEASE}"')
index=index.replace(f'>V{PREVIOUS}</div>',f'>V{RELEASE}</div>')
for entry in RELEASE_ENTRIES:
    index=index.replace(f'{entry}?v={PREVIOUS}',f'{entry}?v={RELEASE}')
Path('index.html').write_text(index)

# Undo the earlier broad test-version replacement. Restore every pre-existing
# suite from the V173.39 baseline, then advance only assertions that represent
# the six release entries / global release label. VFX and old stage asset cache
# keys remain untouched.
for test_path in sorted(Path('tests').glob('*.js')):
    if test_path.name=='v173.40-beginner-balance.test.js':
        continue
    rel=str(test_path).replace('\\','/')
    try:
        text=base_file(rel)
    except subprocess.CalledProcessError:
        continue

    text=text.replace('V_ASSET_VERSION="173\\.39"','V_ASSET_VERSION="173\\.40"')
    text=text.replace('V_ASSET_VERSION="173.39"','V_ASSET_VERSION="173.40"')
    text=text.replace('<title>四象江湖傳 V173\\.39<\\/title>','<title>四象江湖傳 V173\\.40<\\/title>')
    text=text.replace('<title>四象江湖傳 V173.39</title>','<title>四象江湖傳 V173.40</title>')
    text=text.replace('aria-label="目前版本 V173\\.39"','aria-label="目前版本 V173\\.40"')
    text=text.replace('aria-label="目前版本 V173.39"','aria-label="目前版本 V173.40"')
    text=text.replace('v173\\.39-home-version-badge-style','v173\\.40-home-version-badge-style')
    text=text.replace('v173.39-home-version-badge-style','v173.40-home-version-badge-style')
    text=text.replace('>\\s*V173\\.39\\s*<','>\\s*V173\\.40\\s*<')
    text=text.replace('>V173\\.39<\\/div>','>V173\\.40<\\/div>')
    text=text.replace('>V173.39</div>','>V173.40</div>')
    for entry in RELEASE_ENTRIES:
        escaped=entry.replace('/','\\/').replace('.','\\.')
        text=text.replace(f'{escaped}\\?v=173\\.39',f'{escaped}\\?v=173\\.40')
        text=text.replace(f'{entry}?v=173.39',f'{entry}?v=173.40')
    test_path.write_text(text)

# Focused V173.40 regression: synchronize its forest-structure assertion.
p=Path('tests/v173.40-beginner-balance.test.js')
t=p.read_text()
pattern=r'test\("newbie forest owns zero agility monsters",\(\)=>\{[\s\S]*?\n\}\);'
new=r'''test("newbie forest owns zero agility monsters while preserving the six canonical monster rows",()=>{
    const forest=(main.match(/const forestMonsters = \[[\s\S]*?\n\];/)||[])[0]||"";
    assert.equal((forest.match(/makeZoneMonster\("(?:哥布林|史萊姆)"/g)||[]).length,6);
    assert.match(main,/forestMonsters\.forEach\(monster=>\{[\s\S]*?monster\.agilityPoints=0;[\s\S]*?monster\.agility=0;[\s\S]*?monster\.v173BeginnerForest=true;/);
});'''
t,n=re.subn(pattern,lambda _:new,t,count=1)
if n!=1:
    raise SystemExit(f'focused forest test: expected 1 regex match, found {n}')
p.write_text(t)
print('forest roster and V173.40 release-version contracts preserved')
