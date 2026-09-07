from pathlib import Path
import subprocess

OLD = "173.62"
NEW = "173.63"

# Restore tests exactly from the verified dev baseline first; the main release
# migration intentionally updates production/runtime files, while tests need a
# more selective current-version migration so historical feature markers remain intact.
subprocess.run(["git", "checkout", "origin/dev", "--", "tests"], check=True)

plain_replacements = [
    (f"?v={OLD}", f"?v={NEW}"),
    (f'V_ASSET_VERSION="{OLD}"', f'V_ASSET_VERSION="{NEW}"'),
    (f'dataset.runtimeReady="{OLD}"', f'dataset.runtimeReady="{NEW}"'),
    (f'四象江湖傳 V{OLD}', f'四象江湖傳 V{NEW}'),
    (f'目前版本 V{OLD}', f'目前版本 V{NEW}'),
]
regex_replacements = [
    (r"?v=173\.62", r"?v=173\.63"),
    (r'V_ASSET_VERSION=\"173\.62\"', r'V_ASSET_VERSION=\"173\.63\"'),
    (r'dataset\.runtimeReady=\"173\.62\"', r'dataset\.runtimeReady=\"173\.63\"'),
    (r'runtimeReady=\"173\.62\"', r'runtimeReady=\"173\.63\"'),
    (r'四象江湖傳 V173\.62', r'四象江湖傳 V173\.63'),
    (r'目前版本 V173\.62', r'目前版本 V173\.63'),
]

changed = 0
for p in Path("tests").rglob("*.js"):
    text = p.read_text(encoding="utf-8")
    updated = text
    for old, new in plain_replacements:
        updated = updated.replace(old, new)
    for old, new in regex_replacements:
        updated = updated.replace(old, new)
    if updated != text:
        p.write_text(updated, encoding="utf-8")
        changed += 1

if changed == 0:
    raise SystemExit("No current-version test assertions were migrated")

print(f"Aligned current V173.63 assertions in {changed} test files while preserving historical markers")
