from pathlib import Path
import json

OLD = "173.62"
NEW = "173.63"
ROOT = Path(".")


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_required(path, old, new, minimum=1):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path}: expected at least {minimum} occurrence(s) of {old!r}, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")
    return count


# 1) Current visible/runtime version and cache references.
replace_required("index.html", OLD, NEW)
for folder in ("js", "css"):
    for p in Path(folder).rglob("*"):
        if p.is_file() and p.suffix in {".js", ".css"}:
            text = p.read_text(encoding="utf-8")
            updated = text.replace(f"?v={OLD}", f"?v={NEW}")
            if p.as_posix() == "js/20-anonymous-20.js":
                updated = updated.replace(OLD, NEW)
            if updated != text:
                p.write_text(updated, encoding="utf-8")

# Current-version regression assertions must follow the official release/cache version.
for p in Path("tests").rglob("*.js"):
    text = p.read_text(encoding="utf-8")
    updated = text.replace(r"173\.62", r"173\.63").replace(OLD, NEW)
    if updated != text:
        p.write_text(updated, encoding="utf-8")

# 2) Map all verified batches to the official V173.63 release while preserving the DEV verification baseline.
batch_paths = [
    Path("release/requirement-batches/2026-09-07-synthesis-dungeon-equipment-ui.json"),
    Path("release/requirement-batches/2026-09-07-synthesis-vertical-scroll.json"),
    Path("release/requirement-batches/2026-09-07-synthesis-first-render-icons.json"),
    Path("release/requirement-batches/2026-09-07-global-ui-gesture-vfx-lock.json"),
]
for p in batch_paths:
    data = json.loads(p.read_text(encoding="utf-8"))
    previous = data.get("officialVersion") or data.get("releaseVersion") or OLD
    data["verifiedOnDevVersion"] = str(previous)
    if "officialVersion" in data:
        data["officialVersion"] = NEW
        data["officialVersionBumpAllowed"] = True
    if "releaseVersion" in data:
        data["releaseVersion"] = NEW
    data["releasedAs"] = f"V{NEW}"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 3) Global release checklist is updated from stale setup-time states to the evidence already produced by CI/deploy.
requirements = {
    "schemaVersion": 1,
    "releaseVersion": NEW,
    "requirements": [
        {
            "id": "REQ-01",
            "title": "永久完成定義與多項需求逐項驗證規則",
            "status": "VERIFIED",
            "evidence": {
                "files": ["AGENTS.md", "CLAUDE.md", "docs/RELEASE_VERIFICATION_RULES.md", ".github/scripts/release-gate.mjs"],
                "verification": "規範文件與 Release Gate 交叉檢查，且多批 Requirement Batch 實際依 IMPLEMENTED→VERIFIED 流程收尾",
                "result": "PR #74/#78/#79/#82/#83/#84 均依逐項驗證流程執行；未以 commit/CI/deploy 單獨宣稱完成"
            }
        },
        {
            "id": "REQ-02",
            "title": "Requirement Checklist 與 Release Manifest 機制",
            "status": "VERIFIED",
            "evidence": {
                "files": ["release/requirements.json", "release/release.json", ".github/scripts/release-gate.mjs", ".github/workflows/deploy-dev-cloudflare.yml"],
                "verification": "CI schema/assertion + dev artifact manifest + deployed manifest read-back",
                "result": "DEV Run #768 成功產生 manifest、部署並讀回 Commit SHA / Game Version / Cache Version"
            }
        },
        {
            "id": "REQ-03",
            "title": "Game Version 與 Cache Version 一致性檢查",
            "status": "VERIFIED",
            "evidence": {
                "files": ["release/release.json", ".github/scripts/release-gate.mjs", ".github/workflows/ci.yml"],
                "verification": "release-gate ci + loader coherence",
                "result": "DEV/main 多輪 Repository checks 均成功驗證 Game/Cache/loader/HUD 一致"
            }
        },
        {
            "id": "REQ-04",
            "title": "部署前舊版本殘留與部署產物版本檢查",
            "status": "VERIFIED",
            "evidence": {
                "files": [".github/scripts/release-gate.mjs", ".github/workflows/deploy-dev-cloudflare.yml"],
                "verification": "release-gate prepare-artifact + immutable deploy package validation",
                "result": "DEV Run #768 predeploy gate 與 artifact version validation 成功"
            }
        },
        {
            "id": "REQ-05",
            "title": "dev branch HEAD、部署 Commit SHA 與 Cloudflare 實際內容核對",
            "status": "VERIFIED",
            "evidence": {
                "files": [".github/scripts/release-gate.mjs", ".github/workflows/deploy-dev-cloudflare.yml"],
                "verification": "remote dev HEAD preflight + deployed release-manifest fetch",
                "result": "DEV Run #768 exact-SHA deploy 與 deployed SHA/version/cache read-back 全部 SUCCESS"
            }
        },
        {
            "id": "REQ-06",
            "title": "正式移除功能 deprecated-code assertion",
            "status": "VERIFIED",
            "evidence": {
                "files": ["release/deprecated-code.json", ".github/scripts/release-gate.mjs", "index.html", "js/34-v141-core-systems.js"],
                "verification": "release-gate ci 掃描正式 HTML/JS/CSS",
                "result": "巡怪省電模式舊 DOM/handler/key/WakeLock owner 已移除；deprecated-code gate 在 DEV/main CI 持續通過"
            }
        },
        {
            "id": "REQ-07",
            "title": "CI SUCCESS / Deploy SUCCESS 不得等同需求完成",
            "status": "VERIFIED",
            "evidence": {
                "files": ["AGENTS.md", "CLAUDE.md", "release/requirements.json", ".github/scripts/release-gate.mjs", "release/requirement-batches/2026-09-07-global-ui-gesture-vfx-lock.json"],
                "verification": "Release status + Requirement Batch 實機驗證流程",
                "result": "技能 VFX 在 CI/deploy 先成功但手機仍失敗時維持未 VERIFIED，直到使用者實機確認正常才收尾"
            }
        },
        {
            "id": "REQ-08",
            "title": "版本更新前 Requirement Checklist 必須 100% VERIFIED",
            "status": "VERIFIED",
            "evidence": {
                "files": ["AGENTS.md", "CLAUDE.md", ".github/scripts/release-gate.mjs", "release/requirements.json"],
                "verification": "CI_BASE_SHA 版本變更 guard + 100% VERIFIED check",
                "result": "V173.63 僅在四個 Requirement Batch 全數 VERIFIED 且本全域 checklist 10/10 VERIFIED 後進行"
            }
        },
        {
            "id": "REQ-09",
            "title": "Cache invalidation 與玩家 Save Data 完全分離規則",
            "status": "VERIFIED",
            "evidence": {
                "files": ["AGENTS.md", "CLAUDE.md", "docs/RELEASE_VERIFICATION_RULES.md", "release/release.json"],
                "verification": "release diff 與永久規範檢查",
                "result": "V173.63 僅更新版本/cache key/release metadata；未修改玩家存檔 schema、key 或進度資料"
            }
        },
        {
            "id": "REQ-10",
            "title": "main production 實際部署 SHA 自動核對",
            "status": "VERIFIED",
            "evidence": {
                "files": [".github/workflows/ci.yml", "docs/RELEASE_VERIFICATION_RULES.md", "release/requirements.json"],
                "verification": "GitHub Pages platform-managed build/deploy head_sha 與 protected main HEAD 核對",
                "result": "Production Pages Run #100 build/deploy 與 main CI Run #770 均綁定 main SHA ac735f17b5e9ed3526b689bffbf68a2a2c94860c"
            }
        }
    ]
}
Path("release/requirements.json").write_text(json.dumps(requirements, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 4) Official release source of truth.
release = json.loads(Path("release/release.json").read_text(encoding="utf-8"))
release["version"] = NEW
release["cacheVersion"] = NEW
release["status"] = "READY"
release["releaseNotesFile"] = "CHANGELOG.md"
Path("release/release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 5) Human-readable version history: this is the canonical answer to 'what did this version fix?'.
changelog = f'''# 四象江湖傳版本紀錄

## V{NEW} — 2026-09-07

本版本收錄自 V{OLD} 之後，已完成自動化測試、DEV 部署、手機實機驗證與正式 main 發布驗證的修正。

### 合成／裝備／副本 UI
- 冶煉材料階級改為橫向滑動排列，避免內容被向下擠壓裁切。
- 裝備冶煉與材料合成內頁支援完整垂直捲動，可滑至最底部。
- 材料合成移除瀏覽器原生下拉選單，改為《四象江湖傳》黑金／階級色自訂選單。
- 材料合成圖片縮小，釋放下方設計圖升階操作空間。
- 裝備合成與符咒合成首次開啟即顯示正式 icon，不再需要先點擊一次。
- 背包装備比較改為同部位雙欄比較，修正武器／頭部／鞋子等槽位錯配與「明明已裝備卻顯示未裝備」。
- 裝備比較重新分隔 icon、數值與穿戴／售出／鎖定操作區。
- 副本獎勵預覽框加高，長文字不再穿出框或壓到背景圖片。

### 全域 UI／手機操作
- 全遊戲禁止雙指 pinch zoom，同時保留合法的單指上下／左右捲動。
- 全遊戲圖片、SVG、Canvas 等視覺素材禁止長按叫出下載、分享、Google Lens、開新分頁等瀏覽器原生選單。
- 禁止遊戲視覺素材原生拖曳與非輸入區文字選取，避免破壞手遊操作感。

### 戰鬥／技能動畫
- 修復技能 VFX 偶發或整體不顯示問題。
- 恢復玩家與怪物技能 badge 對 V142 動畫 runtime 的 direct trigger，不再依賴容易被後載入程式覆蓋的 wrapper 順序。
- V142 支援 partial-sentinel recovery：若只留下 installed 旗標但 director／trigger 不完整，會重新建立動畫 runtime。
- 移除 V173.51 QA 對 V143 VFX stage visibility 的錯誤 ownership，避免技能名稱／傷害出現但特效舞台被隱藏。
- 新增永久 regression，防止未來再次退回 wrapper-only 導致技能動畫失效。

### 系統／發布安全
- 正式移除巡怪省電模式舊 DOM、handler、設定 key 與相容性 WakeLock 殘留。
- Release Gate、Requirement Checklist、deprecated-code assertion、DEV exact-SHA deploy 與部署後 SHA/version/cache read-back 已實際運作。
- 正式版本升級現在必須同步更新本 CHANGELOG；沒有對應版本紀錄時 CI 會拒絕發布。

### 對應 Requirement Batches
- `2026-09-07-synthesis-dungeon-equipment-ui`
- `2026-09-07-synthesis-vertical-scroll`
- `2026-09-07-synthesis-first-render-icons`
- `2026-09-07-global-ui-gesture-vfx-lock`
'''
Path("CHANGELOG.md").write_text(changelog, encoding="utf-8")

# 6) Make changelog presence an automated release requirement.
gate_path = Path(".github/scripts/release-gate.mjs")
gate = gate_path.read_text(encoding="utf-8")
if "function checkReleaseNotes(config)" not in gate:
    anchor = "function checkVersionAdvanceGuard(config,summary){\n"
    if anchor not in gate:
        raise SystemExit("release-gate anchor missing")
    fn = '''function checkReleaseNotes(config){\n  const relative=config.release.releaseNotesFile||'CHANGELOG.md';\n  const text=readText(ROOT,relative);\n  const pattern=new RegExp(`^##\\\\s+V${escapeRegex(config.version)}(?:\\\\s|$)`,'m');\n  if(!pattern.test(text)) fail(`Release notes missing V${config.version} entry in ${relative}.`);\n}\n'''
    gate = gate.replace(anchor, fn + anchor, 1)

# Require notes in CI, final-ready validation and packaging.
gate = gate.replace(
    "    checkVersionMarkers(ROOT,config);\n    checkDeprecated(ROOT,config.deprecated);\n    checkVersionAdvanceGuard(config,summary);",
    "    checkVersionMarkers(ROOT,config);\n    checkReleaseNotes(config);\n    checkDeprecated(ROOT,config.deprecated);\n    checkVersionAdvanceGuard(config,summary);",
    1,
)
gate = gate.replace(
    "    checkVersionMarkers(ROOT,config);\n    checkDeprecated(ROOT,config.deprecated);\n    ensureReleaseReady(config,summary);",
    "    checkVersionMarkers(ROOT,config);\n    checkReleaseNotes(config);\n    checkDeprecated(ROOT,config.deprecated);\n    ensureReleaseReady(config,summary);",
    1,
)
gate = gate.replace(
    "    checkVersionMarkers(ROOT,config);\n    checkDeprecated(ROOT,config.deprecated);\n    const deployRoot=path.resolve",
    "    checkVersionMarkers(ROOT,config);\n    checkReleaseNotes(config);\n    checkDeprecated(ROOT,config.deprecated);\n    const deployRoot=path.resolve",
    1,
)
gate_path.write_text(gate, encoding="utf-8")

# 7) Permanent written rule matching the automated gate.
doc_path = Path("docs/RELEASE_VERIFICATION_RULES.md")
doc = doc_path.read_text(encoding="utf-8")
marker = "## 正式版本與 CHANGELOG 對應規則"
if marker not in doc:
    doc += f'''\n\n{marker}\n\n- 正式 Game Version 只代表已完成 Requirement Verification、可對外辨識的發布批次。\n- 每次正式版本變更都必須同步更新 `CHANGELOG.md`，新增 `## V<版本號>` 條目。\n- 該條目必須說明本版本實際修正／新增內容，並列出對應 Requirement Batch。\n- 版本號不得只作為 cache busting 或畫面裝飾；若沒有對應 CHANGELOG，Release Gate 必須失敗。\n- Game Version 與 Cache Version 仍需同步，但兩者用途不同：Game Version 用於版本追蹤，Cache Version 用於資源失效。\n'''
    doc_path.write_text(doc, encoding="utf-8")

# 8) Safety assertions before CI.
active_paths = [Path("index.html"), *Path("js").rglob("*.js"), *Path("css").rglob("*.css"), *Path("tests").rglob("*.js")]
leftovers = []
for p in active_paths:
    text = p.read_text(encoding="utf-8")
    if f"?v={OLD}" in text:
        leftovers.append(f"stale cache ref in {p}")
if leftovers:
    raise SystemExit("\n".join(leftovers))

index = Path("index.html").read_text(encoding="utf-8")
loader = Path("js/20-anonymous-20.js").read_text(encoding="utf-8")
if f"<title>四象江湖傳 V{NEW}</title>" not in index:
    raise SystemExit("index title not bumped")
if f'const V_ASSET_VERSION="{NEW}"' not in loader:
    raise SystemExit("loader cache version not bumped")
if f'dataset.runtimeReady="{NEW}"' not in loader:
    raise SystemExit("runtimeReady not bumped")

print("V173.63 release migration prepared successfully")
