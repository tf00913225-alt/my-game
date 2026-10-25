"""Inbox-only lossless conversion and actual-size review copies; never edits sources."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
IDS = [f"{gender}_{i:02d}" for gender in ("male", "female") for i in range(1, 5)]
SIZE = (1024, 1536)
PREVIEW = (84, 126)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_pair(identity):
    paths = {side: ROOT / f"player_{identity}_patrol_{side}_source.png"
             for side in ("front", "back")}
    missing = [path.name for path in paths.values() if not path.is_file()]
    if missing:
        return {"identity": identity, "status": "pending", "missing": missing}
    result = {"identity": identity, "status": "pass", "assets": []}
    thumbnails = []
    for side, source in paths.items():
        before = digest(source)
        with Image.open(source) as opened:
            opened.load()
            assert opened.mode == "RGBA", f"Expected RGBA: {source.name}"
            assert opened.size == SIZE, f"Unexpected source canvas: {source.name}"
            image = opened.copy()
        alpha = image.getchannel("A")
        alpha_range = alpha.getextrema()
        width, height = image.size
        corners = {
            "topLeft": (0, 0, 24, 24),
            "topRight": (width - 24, 0, width, 24),
            "bottomLeft": (0, height - 24, 24, height),
            "bottomRight": (width - 24, height - 24, width, height),
        }
        corner_alpha = {name: alpha.crop(box).getextrema()[1]
                        for name, box in corners.items()}
        assert alpha_range[0] == 0 and alpha_range[1] > 200, source.name
        target = ROOT / f"player_{identity}_patrol_{side}.webp"
        # The human-approved male01 master/WebP are immutable in this batch.
        convert = identity != "male_01"
        exact_existing = False
        if target.is_file():
            with Image.open(target) as existing:
                exact_existing = existing.size == SIZE and existing.convert("RGBA").tobytes() == image.tobytes()
        if convert and not exact_existing:
            image.save(target, "WEBP", lossless=True, quality=100, method=6, exact=True)
        assert target.is_file(), f"Missing approved WebP: {target.name}"
        with Image.open(target) as decoded:
            decoded.load()
            assert decoded.size == image.size, target.name
            assert decoded.convert("RGBA").tobytes() == image.tobytes(), target.name
        assert digest(source) == before, f"Source mutated: {source.name}"
        preview = ROOT / f"player_{identity}_patrol_{side}_preview_84x126.png"
        thumb = image.resize(PREVIEW, Image.Resampling.LANCZOS)
        if identity != "male_01" or not preview.exists():
            thumb.save(preview)
        thumbnails.append(thumb)
        result["assets"].append({
            "side": side, "source": source.name, "webp": target.name,
            "sourceSha256": before, "webpSha256": digest(target),
            "sourceMode": "RGBA", "sourceSize": list(image.size),
            "decodedSize": list(SIZE), "alphaExtrema": list(alpha_range),
            "corner24MaxAlpha": corner_alpha,
            "rgbaPixelExact": True, "alphaExact": True, "sourceUnchanged": True,
            "conversion": "Pillow WebP lossless=True quality=100 method=6 exact=True"
                if identity != "male_01" else "Existing human-approved WebP; verified, not rewritten",
            "preview": preview.name, "previewSize": list(PREVIEW),
        })
    pair = Image.new("RGB", (230, 180), "#313b39")
    draw = ImageDraw.Draw(pair)
    draw.text((12, 7), identity + " / 84x126 each", fill="white")
    for i, thumb in enumerate(thumbnails):
        draw.text((18 + 112 * i, 25), ("front", "back")[i], fill="white")
        pair.paste(thumb, (18 + 112 * i, 45), thumb)
    pair_path = ROOT / f"player_{identity}_patrol_batch_comparison.png"
    pair.save(pair_path)
    result["comparison"] = pair_path.name
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=IDS, nargs="*",
                        help="Process these pairs; retain other report rows until next run")
    args = parser.parse_args()
    report_path = ROOT / "batch-technical-verification.json"
    existing = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    prior = {row["identity"]: row for row in existing.get("pairs", [])}
    rows = []
    for identity in IDS:
        if args.only is not None and identity not in args.only:
            rows.append(prior.get(identity, {"identity": identity, "status": "pending", "reason": "Not processed yet"}))
            continue
        try:
            rows.append(verify_pair(identity))
        except Exception as error:
            rows.append({"identity": identity, "status": "fail", "error": str(error)})
    sheet = Image.new("RGB", (920, 360), "#313b39")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        x, y = (i % 4) * 230, (i // 4) * 180
        if row["status"] == "pass":
            with Image.open(ROOT / row["comparison"]) as pair:
                sheet.paste(pair, (x, y))
        else:
            draw.text((x + 12, y + 12), row["identity"] + ": " + row["status"], fill="white")
    sheet.save(ROOT / "all-eight-patrol-84x126-comparison.png")
    counts = {status: sum(row["status"] == status for row in rows)
              for status in ("pass", "pending", "fail")}
    report = {
        "workId": "PLAYER-PATROL-SAMPLE-20261025",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "fail" if counts["fail"] else "pending" if counts["pending"] else "pass",
        "scope": "Inbox-only technical verification; NOT art approval, runtime, animation or deployment acceptance",
        "sourcePolicy": "No trim/crop/resize/rotate/alpha changes; only labeled 84x126 review copies resized",
        "backgroundCleanliness": "Corner alpha values are observations only. Clean background requires separate visual QA; pixel-exact conversion does not certify it.",
        "previewSheet": "all-eight-patrol-84x126-comparison.png",
        "counts": counts, "pairs": rows,
    }
    report_path.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"status": report["status"], "counts": counts}))
    return 1 if counts["fail"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
