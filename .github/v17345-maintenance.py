from pathlib import Path

# Retry after correcting the focused V173.45 regression harness and the historical Abyss arena expectation.
OLD="173.44"
NEW="173.45"


def replace_plain(path: str):
    p=Path(path)
    source=p.read_text(encoding="utf-8")
    if OLD not in source:
        raise SystemExit(f"{path}: expected {OLD}")
    p.write_text(source.replace(OLD,NEW),encoding="utf-8")


# Release-facing runtime/cache version.
replace_plain("index.html")
replace_plain("js/20-anonymous-20.js")
replace_plain(".github/workflows/deploy-dev-cloudflare.yml")

# Historical regression suites intentionally follow the current release
# version in their static loader/title expectations. Keep filenames historical,
# but advance both plain and regex-escaped literals in their contents.
for path in sorted(Path("tests").glob("*.js")):
    source=path.read_text(encoding="utf-8")
    updated=source.replace(r"173\.44",r"173\.45").replace(OLD,NEW)
    if updated!=source:
        path.write_text(updated,encoding="utf-8")

# HANDOFF is historical documentation, so only prepend the new current-dev
# section and never rewrite older V173.44 release notes.
handoff=Path("HANDOFF.md")
source=handoff.read_text(encoding="utf-8")
heading="## V173.45 戰鬥／副本／商店／深淵維修（目前 dev）"
if heading not in source:
    section="""
## V173.45 戰鬥／副本／商店／深淵維修（目前 dev）
- 水元素【淨心訣】手動施放時可自由選擇我方或敵方：我方解除所有增益與異常；敵方解除所有正面增益（含結界、護盾等）但保留敵方既有負面狀態。
- 金幣副本勝利結算補回正式金幣獎勵函式，修正 undefined 例外造成的勝利畫面卡死；同時複核經驗／材料副本仍走各自既有有效結算入口。
- 三輪日常副本換場的 360ms 銜接期間維持 battleActive，元素匣不再把換場誤判成戰鬥外而自動補血。
- 元素匣戰鬥外補品通知改為畫面上方約 1/4 的純文字六行佇列；只顯示「[角色使用補品 恢復xxHP/SP]」，超過六行由最舊訊息往上移除，不再寫入下一場戰鬥資訊。
- 合成介面移除「裝備合成」分頁，只保留裝備冶煉、符咒合成、碎片合成；既有舊存檔相容函式保留但不再提供裝備合成入口。
- 商店新增「補品／裝備」雙頁；裝備頁目前先完成六格版面與每日刷新框架：前5次免費、總上限10次；第6～10次金幣刷新價格與裝備售價尚未定案，因此本輪只顯示待設定狀態、不擅自扣款。
- 任務紅點拆分每日／委託來源；主入口仍顯示任一可領獎勵，任務頁內則由各自分頁顯示自己的紅點。
- 深淵戰鬥資訊加入全域 touch-lock 捲動白名單並保留原生 pan-y；守關帝王／寶箱／接近點統一移到上方平台約 x61%、y21%，對齊本輪參考圖紅圈位置。
- 僅修改 dev，main 不動；完整載入／快取版本同步 V173.45。

"""
    handoff.write_text(section+source.lstrip("\n"),encoding="utf-8")
