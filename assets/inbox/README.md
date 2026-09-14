# assets/inbox

此目錄只用於原始母圖、待處理素材與尚未正式導入的 staging assets。

- 正式 runtime 不得直接引用 `assets/inbox/`。
- 已正式採用的 VFX 必須移至 `assets/vfx/<element>/` 等正式路徑。
- 圖片格式、WebP、透明度、尺寸與 Sprite Sheet 驗證以 `docs/IMAGE_ASSET_SPEC.md` 為準。
- 不得因整理 inbox 而刪除仍被正式程式引用的素材。

2026-09-14：既有正式 Wind VFX 已由 `assets/inbox/` 遷移至 `assets/vfx/wind/`；本次只搬移原始 blob，不重新壓縮、不改尺寸、不改幀排列。
