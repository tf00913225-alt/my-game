from pathlib import Path
import subprocess

OLD = "173.62"
NEW = "173.63"

# Restore tests exactly from the verified dev baseline first; the main release
# migration intentionally updates production/runtime files, while tests need a
# selective current-version migration so historical feature markers remain intact.
subprocess.run(["git", "checkout", "origin/dev", "--", "tests"], check=True)

plain_replacements = [
    (f"?v={OLD}", f"?v={NEW}"),
    (f'V_ASSET_VERSION="{OLD}"', f'V_ASSET_VERSION="{NEW}"'),
    (f'dataset.runtimeReady="{OLD}"', f'dataset.runtimeReady="{NEW}"'),
    (f'runtimeReady="{OLD}"', f'runtimeReady="{NEW}"'),
    (f'四象江湖傳 V{OLD}', f'四象江湖傳 V{NEW}'),
    (f'目前版本 V{OLD}', f'目前版本 V{NEW}'),
]

# These are the literal characters that appear inside JavaScript RegExp
# literals in the test source. Keep this list narrow: it updates only current
# release/cache assertions, never historical comments such as
# "V173.62 — feature first introduced here".
regex_literal_replacements = [
    (r"?v=173\.62", r"?v=173\.63"),
    (r'V_ASSET_VERSION="173\.62"', r'V_ASSET_VERSION="173\.63"'),
    (r'dataset\.runtimeReady="173\.62"', r'dataset\.runtimeReady="173\.63"'),
    (r'runtimeReady="173\.62"', r'runtimeReady="173\.63"'),
    (r'四象江湖傳 V173\.62', r'四象江湖傳 V173\.63'),
    (r'目前版本 V173\.62', r'目前版本 V173\.63'),
]

changed = 0
for p in Path("tests").rglob("*.js"):
    text = p.read_text(encoding="utf-8")
    updated = text
    for old, new in plain_replacements:
        updated = updated.replace(old, new)
    for old, new in regex_literal_replacements:
        updated = updated.replace(old, new)
    if updated != text:
        p.write_text(updated, encoding="utf-8")
        changed += 1

if changed == 0:
    raise SystemExit("No current-version test assertions were migrated")

# Safety: known historical marker must remain old-version evidence.
historical = Path("tests/ui-large-panel-followup.test.js").read_text(encoding="utf-8")
if r"V173\.62 — character and dungeon backpack use the maximum mobile canvas" not in historical:
    raise SystemExit("Historical V173.62 feature marker was unexpectedly rewritten")

# Safety: known current-version assertion must advance.
v137 = Path("tests/v137-regressions.test.js").read_text(encoding="utf-8")
if r'V_ASSET_VERSION="173\.63"' not in v137:
    raise SystemExit("Current V_ASSET_VERSION regex assertion did not advance to 173.63")

print(f"Aligned current V173.63 assertions in {changed} test files while preserving historical markers")
