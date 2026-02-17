import json
import os
import requests

API_KEY = os.getenv("PARSE_API_KEY")
BASE_URL = "https://api.parse.bot"
SCRAPER_ID = "d2e043f3-3057-4355-b349-498b473ddb8d"
MONTHS = 6

def unwrap_data(payload):
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    return payload or {}


def call(endpoint, **params):
    if not API_KEY:
        raise RuntimeError("PARSE_API_KEY is not set")
    url = f"{BASE_URL}/scraper/{SCRAPER_ID}/{endpoint}"
    headers = {
        "X-API-Key": API_KEY,
    }
    resp = requests.get(url, headers=headers, params=params, timeout=90)
    if not resp.ok:
        print(f"request_failed endpoint={endpoint} status={resp.status_code}")
        print(resp.text[:3000])
        resp.raise_for_status()

    return resp.json()


if __name__ == "__main__":
    latest_payload = call("get_latest_patch_dates", months=MONTHS)
    latest = unwrap_data(latest_payload)
    patches = latest.get("patches", [])

    print("get_latest_patch_dates keys:", sorted(latest.keys()))
    print("patch_count:", len(patches))
    if not patches:
        raise SystemExit("No patches found")

    first_patch = patches[0]
    patch_id = first_patch.get("patch_id") or first_patch.get("id") or first_patch.get("version")
    if not patch_id:
        raise SystemExit("No patch id available")

    print("first_patch:", json.dumps(first_patch, indent=2)[:1200])

    notes_payload = call("get_patch_notes", patch_id=patch_id)
    notes = unwrap_data(notes_payload)
    raw_notes = notes.get("raw_notes") or notes.get("raw_content") or ""

    print("\nget_patch_notes keys:", sorted(notes.keys()))
    print("raw_notes_len:", len(raw_notes))
    if not raw_notes:
        raise SystemExit("No raw notes returned")

    parsed_payload = call("parse_and_format_patch_notes", raw_notes=raw_notes)
    parsed = unwrap_data(parsed_payload)

    print("\nparse_and_format_patch_notes keys:", sorted(parsed.keys()))
    for key in ["features", "bug_fixes", "known_issues", "sections"]:
        value = parsed.get(key)
        if isinstance(value, list):
            print(f"{key}: list[{len(value)}]")
        elif value is None:
            print(f"{key}: missing")
        else:
            print(f"{key}: {type(value).__name__}")

    print("\nparsed_sample:")
    print(json.dumps(parsed, indent=2)[:5000])
