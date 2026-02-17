#!/usr/bin/env python3
import datetime as dt
import json
import os
import re
from pathlib import Path

import requests
from urllib.parse import quote

BASE_URL = "https://api.parse.bot"
SCRAPER_ID = "d2e043f3-3057-4355-b349-498b473ddb8d"
DEFAULT_MONTHS_FETCH = 6
WINDOW_MONTHS = 3
MAX_PATCHES = 20

API_KEY = os.getenv("PARSE_API_KEY")
ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "patches.json"
OUT_JS_FILE = ROOT / "data" / "patches.js"


def call(endpoint: str, **params):
    if not API_KEY:
        raise RuntimeError("PARSE_API_KEY is not set")
    url = f"{BASE_URL}/scraper/{SCRAPER_ID}/{endpoint}"
    resp = requests.get(url, headers={"X-API-Key": API_KEY}, params=params, timeout=120)
    resp.raise_for_status()
    payload = resp.json()
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    return payload


def clean_wiki_text(value: str) -> str:
    text = str(value or "")
    text = re.sub(r"<ref[^>]*>.*?</ref>", " ", text, flags=re.I | re.S)
    text = re.sub(r"{{[^{}]*}}", " ", text)
    text = re.sub(r"\[https?://[^\s\]]+\s([^\]]+)\]", r"\1", text)
    text = re.sub(r"\[https?://[^\]]+\]", " ", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    text = text.replace("'''", "").replace("''", "")
    text = re.sub(r"^\*+\s*", "", text)
    text = re.sub(r"^\|+\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def should_ignore(raw: str, cleaned: str) -> bool:
    src = str(raw or "").strip()
    if not src or not cleaned:
        return True
    if re.match(r"^{{PatchData", src, re.I):
        return True
    if src == "}}":
        return True
    if re.match(r"^\|\s*[a-z_]+\s*=", src, re.I):
        return True
    if re.match(r"^(\{\||\|-|\|\})", src):
        return True
    if re.match(r"^==.*==$", src):
        return True
    if cleaned.lower().startswith(("colspan", "class=")):
        return True
    if cleaned.lower() in {"right|thumb", "thumb", "right"}:
        return True
    if cleaned.lower().startswith("category:"):
        return True
    return len(cleaned) < 3


def normalize_lines(value):
    if isinstance(value, list):
        lines = [str(v).strip() for v in value]
    elif isinstance(value, str):
        lines = [x.strip() for x in value.split("\n")]
    else:
        lines = []
    return [x for x in lines if x]


def extract_build_channel(raw_notes: str) -> str:
    m = re.search(r"buildnumber\s*=\s*([^\n]+)", raw_notes or "", flags=re.I)
    build = m.group(1).strip() if m else ""
    if re.search(r"\bEPTU\b", build, re.I):
        return "EPTU"
    if re.search(r"\bPTU\b", build, re.I):
        return "PTU"
    return "LIVE"


def parse_release_date(notes_release_date: str, raw_notes: str):
    if notes_release_date:
        try:
            return dt.datetime.fromisoformat(notes_release_date.replace("Z", "+00:00")).date()
        except ValueError:
            pass

    m = re.search(r"publishdate\s*=\s*(\d{4}-\d{2}-\d{2})", raw_notes or "", flags=re.I)
    if m:
        try:
            return dt.date.fromisoformat(m.group(1))
        except ValueError:
            return None
    return None


_WIKI_RELEASE_CACHE = {}


def fetch_release_date_from_wiki(version: str):
    key = str(version or "").strip()
    if not key:
        return None
    if key in _WIKI_RELEASE_CACHE:
        return _WIKI_RELEASE_CACHE[key]

    try:
        url = f"https://starcitizen.tools/Update:Star_Citizen_Alpha_{quote(key)}"
        resp = requests.get(url, timeout=30)
        if not resp.ok:
            _WIKI_RELEASE_CACHE[key] = None
            return None

        html = resp.text
        patterns = [
            r"released on\s*(\d{4}-\d{2}-\d{2})",
            r"Released</span>[^<]*(\d{4}-\d{2}-\d{2})",
        ]
        for pattern in patterns:
            m = re.search(pattern, html, flags=re.I)
            if not m:
                continue
            try:
                parsed = dt.date.fromisoformat(m.group(1))
                _WIKI_RELEASE_CACHE[key] = parsed
                return parsed
            except ValueError:
                continue
    except Exception:
        pass

    _WIKI_RELEASE_CACHE[key] = None
    return None


def format_month_year(value):
    if not value:
        return "Recent"
    return value.strftime("%B %Y")


def unique(items):
    seen = set()
    out = []
    for item in items:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def extract_categories(parsed_data):
    sections = parsed_data.get("sections") if isinstance(parsed_data, dict) else []
    sections = sections if isinstance(sections, list) else []

    extracted = {
        "overview": [],
        "features": [],
        "improvements": [],
        "fixes": [],
        "ships": [],
        "known_issues": [],
    }
    current = "features"

    for section in sections:
        for line in normalize_lines(section.get("content") if isinstance(section, dict) else []):
            cleaned = clean_wiki_text(line)
            if should_ignore(line, cleaned):
                continue

            low = cleaned.lower()
            if "is a major update" in low:
                extracted["overview"].append(cleaned)
                continue

            raw = str(line)
            if re.match(r"^\*?\s*'''?\s*ships?\s*&?\s*vehicles?\s*'''?$", raw, re.I):
                current = "ships"
                continue
            if re.match(r"^\*?\s*'''?\s*(core tech|audio|technical)", raw, re.I):
                current = "improvements"
                continue
            if re.search(r"known issues?", low):
                current = "known_issues"
                continue
            if re.search(r"bug fixes?|technical updates?", low) and "contains over" not in low:
                current = "fixes"
                continue
            if re.match(r"^\*?\s*'''?\s*gameplay\s*'''?$", raw, re.I):
                current = "features"
                continue

            if re.search(r"client crash fixes?|server crash fixes?|crash fix|bug fix", low):
                extracted["fixes"].append(cleaned)
                continue
            if re.search(r"ship|vehicle|aurora|lamp|missile|cockpit", low):
                extracted["ships"].append(cleaned)
                continue
            if re.search(r"performance|technical|polish|quality|balance|engineering", low):
                extracted["improvements"].append(cleaned)
                continue

            extracted[current].append(cleaned)

    features = unique([clean_wiki_text(v) for v in normalize_lines(parsed_data.get("features", []))] + extracted["features"])
    fixes = unique([clean_wiki_text(v) for v in normalize_lines(parsed_data.get("bug_fixes", []))] + extracted["fixes"])
    known = unique([clean_wiki_text(v) for v in normalize_lines(parsed_data.get("known_issues", []))] + extracted["known_issues"])
    improvements = unique(extracted["improvements"])
    ships = unique(extracted["ships"])
    overview = unique(extracted["overview"])[:2]

    categories = []
    if overview:
        categories.append({"name": "Overview", "items": overview})
    if features:
        categories.append({"name": "Features", "items": features})
    if improvements:
        categories.append({"name": "Improvements", "items": improvements})
    if fixes:
        categories.append({"name": "Bug Fixes", "items": fixes})
    if ships:
        categories.append({"name": "Ship Updates", "items": ships})
    if known:
        categories.append({"name": "Known Issues", "items": known})

    stats = {
        "features": len(features),
        "improvements": len(improvements),
        "fixes": len(fixes),
        "ships": len(ships),
    }

    return categories, stats


def build_dataset():
    latest = call("get_latest_patch_dates", months=DEFAULT_MONTHS_FETCH)
    patch_list = latest.get("patches", []) if isinstance(latest, dict) else []

    cutoff = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=WINDOW_MONTHS * 31)
    patches = []

    for item in patch_list[:MAX_PATCHES]:
        patch_id = item.get("patch_id") or item.get("id") or item.get("version")
        if not patch_id:
            continue

        notes = call("get_patch_notes", patch_id=patch_id)
        raw_notes = notes.get("raw_notes") or notes.get("raw_content") or ""
        if not raw_notes:
            continue

        release_date = parse_release_date(notes.get("release_date"), raw_notes)

        # Parse API dates can drift or be normalized; prefer canonical release date from StarCitizen.tools when available.
        wiki_release_date = fetch_release_date_from_wiki(item.get("version") or "")
        if wiki_release_date:
            release_date = wiki_release_date

        if release_date and release_date < cutoff:
            continue

        parsed = call("parse_and_format_patch_notes", raw_notes=raw_notes)
        categories, stats = extract_categories(parsed)
        if not categories:
            continue

        version = item.get("version") or notes.get("title") or patch_id
        patches.append(
            {
                "patch_id": str(patch_id),
                "version": str(version),
                "title": str(notes.get("title") or item.get("title") or version),
                "release_date_iso": release_date.isoformat() if release_date else None,
                "release_date_display": format_month_year(release_date),
                "build_channel": extract_build_channel(raw_notes),
                "status": "Current" if not patches else "Archived",
                "stats": stats,
                "categories": categories,
            }
        )

    dataset = {
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "window_months": WINDOW_MONTHS,
        "patch_count": len(patches),
        "patches": patches,
    }
    return dataset


def normalize_existing_dataset_dates(dataset: dict) -> dict:
    patches = dataset.get("patches") if isinstance(dataset, dict) else None
    if not isinstance(patches, list):
        return dataset

    changed = 0
    for patch in patches:
        if not isinstance(patch, dict):
            continue
        version = str(patch.get("version") or "").strip()
        if not version:
            continue
        wiki_date = fetch_release_date_from_wiki(version)
        if not wiki_date:
            continue
        iso = wiki_date.isoformat()
        display = format_month_year(wiki_date)
        if patch.get("release_date_iso") != iso or patch.get("release_date_display") != display:
            patch["release_date_iso"] = iso
            patch["release_date_display"] = display
            changed += 1

    if changed:
        print(f"Normalized release dates for {changed} patches from StarCitizen.tools")
    return dataset


def main():
    try:
        dataset = build_dataset()
    except Exception as error:
        if OUT_FILE.exists():
            print(f"API refresh failed ({error}); reusing existing {OUT_FILE.name}")
            dataset = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        else:
            raise

    dataset = normalize_existing_dataset_dates(dataset)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    OUT_JS_FILE.write_text(
        "window.STAR_NOTES_DATA = " + json.dumps(dataset, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_FILE} and {OUT_JS_FILE} with {dataset['patch_count']} patches")


if __name__ == "__main__":
    main()
