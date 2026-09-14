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
    assert.match(uiSource,/v141-dungeon-return/);
    assert.match(cssSource,/\\.v141-dungeon-active #bottomNav,[\\s\\S]*\\.v148-context-nav-active #bottomNav\\{display:none !important;\\}/);'''
assert old_block in text, "V141 stale dungeon nav assertions not found"
text = text.replace(old_block, new_block, 1)
Path(path).write_text(text, encoding="utf-8")

v146_path = Path("tests/v146-system-polish.test.js")
v146 = v146_path.read_text(encoding="utf-8")
source_import = 'const source=fs.readFileSync("js/41-v146-system-polish.js","utf8");'
assert source_import in v146, "V146 source import not found"
v146 = v146.replace(
    source_import,
    source_import + '\nconst finalNavSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");',
    1,
)
old_nav_asserts = '''    assert.ok(source.includes('buttons.push(["返回","assets/ui/map-return.png",returnAction]);'));
    assert.match(source,/abyssSelectionActive\\?"v174AbyssLeaveToGameplay\\(\\)":"showPage\\('home'\\)"/);'''
new_nav_asserts = '''    assert.match(source,/v148SyncContextNavigation/);
    assert.doesNotMatch(source,/function dungeonNavMarkup\\(/);
    assert.ok(finalNavSource.includes('buttons.push(["返回","assets/ui/map-return.png",returnAction]);'));
    assert.match(finalNavSource,/abyssSelectionActive\\?"v174AbyssLeaveToGameplay\\(\\)":"showPage\\('home'\\)"/);'''
assert old_nav_asserts in v146, "V146 stale return-nav assertions not found"
v146 = v146.replace(old_nav_asserts, new_nav_asserts, 1)
v146 = v146.replace(
    '    assert.match(source,/\\["秘寶","assets\\/ui\\/nav-relic-v175\\.webp","openHomeFeature\\(\'relic\'\\)"\\]/);',
    '    assert.match(finalNavSource,/\\["秘寶","assets\\/ui\\/nav-relic-v175\\.webp","openHomeFeature\\(\'relic\'\\)"\\]/);',
    1,
)
v146 = v146.replace(
    '    assert.match(source,/\\["元素匣","assets\\/ui\\/nav-element-box\\.png","openHomeFeature\\(\'autoBattleSettings\'\\)"\\]/);',
    '    assert.match(finalNavSource,/\\["元素匣","assets\\/ui\\/nav-element-box\\.png","openHomeFeature\\(\'autoBattleSettings\'\\)"\\]/);',
    1,
)
assert 'assert.match(finalNavSource,/\\["秘寶"' in v146
assert 'assert.match(finalNavSource,/\\["元素匣"' in v146
v146_path.write_text(v146, encoding="utf-8")

# V174's old browser snapshot expected the enemy name above the portrait.
# The approved layout now keeps the full portrait visible and places identity
# below the monster's own HP/SP bars, matching the player's requested hierarchy.
v174_browser_path = Path("tests/v174-cardless-battle-browser.test.js")
v174_browser = v174_browser_path.read_text(encoding="utf-8")
old_enemy_name_guard = '    assert.ok(data.enemyNameRect.bottom<=data.enemyArtRect.top+1,"monster name must sit above monster artwork");'
new_enemy_name_guard = '    assert.ok(data.enemySpRect.bottom<=data.enemyNameRect.top+1,"monster name must sit below its own HP/SP bars");'
assert old_enemy_name_guard in v174_browser, "V174 stale monster-name geometry assertion not found"
v174_browser_path.write_text(v174_browser.replace(old_enemy_name_guard, new_enemy_name_guard, 1), encoding="utf-8")
