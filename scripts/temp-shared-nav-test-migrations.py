import subprocess
from pathlib import Path

BASE_TEST_COMMIT = "0c337274dd743ec74988ff4fa112b19802bb77a9"
path = "tests/v141-system-expansion.test.js"
text = subprocess.check_output(["git", "show", f"{BASE_TEST_COMMIT}:{path}"], text=True)

ui_import = 'const uiSource=fs.readFileSync("js/35-v141-ui-battle.js","utf8");'
assert ui_import in text
text = text.replace(
    ui_import,
    ui_import + '\nconst finalNavSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");',
    1,
)

old_block = '''    assert.match(uiSource,/openMapInventoryOverlay\\(\\)/);
    assert.match(uiSource,/v141-dungeon-return/);
    assert.match(cssSource,/\\.v141-dungeon-active #bottomNav\\{display:none !important;\\}/);'''
new_block = '''    assert.match(finalNavSource,/openMapInventoryOverlay\\(\\)/);
    assert.match(uiSource,/v148SyncContextNavigation/);
    assert.doesNotMatch(uiSource,/v141-dungeon-return/);
    assert.match(cssSource,/\\.v141-dungeon-active #bottomNav,[\\s\\S]*\\.v148-context-nav-active #bottomNav\\{display:none !important;\\}/);'''
assert old_block in text, "V141 stale dungeon nav assertions not found"
text = text.replace(old_block, new_block, 1)

Path(path).write_text(text, encoding="utf-8")
