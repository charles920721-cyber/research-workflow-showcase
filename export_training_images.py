# -*- coding: utf-8 -*-
"""Export pancreatic training CM/Curves images into showcase/images for static hosting."""
from __future__ import annotations

import hashlib
import json
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANALYSIS = ROOT / "data" / "pancreatic_analysis.json"
OUT = ROOT / "images"
MANIFEST = ROOT / "data" / "image_manifest.json"
API = "http://127.0.0.1:8080/api/pancreatic/analysis/image"
RESULTS = Path(r"D:\碩論研究\成果\網站")


def item_key(item_id: str) -> str:
    return hashlib.sha1(item_id.encode("utf-8")).hexdigest()[:16]


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"Cookie": "site_version=test"})
        # Use a session cookie from visiting /app/test is hard; try without first,
        # then with opener that hits /app/test.
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        if not data or data[:1] == b"{":
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def fetch_with_session(url: str, dest: Path, opener) -> bool:
    try:
        with opener.open(url, timeout=180) as resp:
            data = resp.read()
        if not data or data[:1] == b"{":
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception:
        return False


def copy_run_images(folder: Path, out_dir: Path) -> dict:
    counts = {"cm": 0, "curves": 0}
    for run_dir in sorted(folder.glob("Run_*")):
        if not run_dir.is_dir():
            continue
        run_name = run_dir.name  # Run_01
        for kind, sub in (("cm", "CM"), ("curves", "Curves")):
            src_dir = run_dir / sub
            if not src_dir.is_dir():
                continue
            matches = sorted(list(src_dir.glob("*.png")) + list(src_dir.glob("*.jpg")))
            if not matches:
                continue
            ext = matches[0].suffix.lower() or ".png"
            dest = out_dir / f"{run_name}_{kind}{ext}"
            shutil.copy2(matches[0], dest)
            counts[kind] += 1
    return counts


def main() -> None:
    payload = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    items = payload.get("items") or []
    OUT.mkdir(parents=True, exist_ok=True)

    jar = urllib.request.HTTPCookieProcessor()
    opener = urllib.request.build_opener(jar)
    opener.open("http://127.0.0.1:8080/app/test", timeout=30).read()

    manifest = {}
    for item in items:
        item_id = item.get("id") or ""
        if not item_id:
            continue
        key = item_key(item_id)
        out_dir = OUT / key
        out_dir.mkdir(parents=True, exist_ok=True)

        folder = RESULTS / item_id
        copied = {"cm": 0, "curves": 0}
        if folder.is_dir():
            copied = copy_run_images(folder, out_dir)

        all_path = out_dir / "all_curves.png"
        q = urllib.parse.urlencode({"item": item_id, "kind": "curves", "all_runs": 1})
        ok_all = fetch_with_session(f"{API}?{q}", all_path, opener)

        manifest[item_id] = {
            "key": key,
            "all_curves": ok_all and all_path.is_file(),
            "cm": copied["cm"],
            "curves": copied["curves"],
            "run_count": item.get("run_count") or 0,
        }
        print(f"{key} all={ok_all} cm={copied['cm']} curves={copied['curves']} :: {item_id[:60]}")

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {MANIFEST} entries={len(manifest)}")


if __name__ == "__main__":
    main()
