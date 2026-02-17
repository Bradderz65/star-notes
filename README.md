# Star Notes

A lightweight, single-page website for displaying **Star Citizen** patch notes with a clean dashboard layout.

## Features

- Version header with release metadata
- Stats cards for features, improvements, fixes, and ship updates
- Expandable patch note categories
- Version history section
- Responsive layout for desktop and mobile
- No build tools or dependencies required

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Python (for patch data generation script)

## Project Structure

- `index.html` - App structure and content sections
- `styles.css` - Theme, layout, and responsive styling
- `main.js` - UI rendering logic (reads local dataset)
- `data/patches.json` - Static patch dataset served to users
- `scripts/update_patch_data.py` - Pulls, cleans, and prunes API data (last 3 months)

## Run Locally

Open `index.html` directly in your browser, or serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Updating Patch Notes

Generate a fresh local dataset:

```bash
python3 scripts/update_patch_data.py
```

This writes `data/patches.json`, and the website loads that local file only.

## Automated Schedule

A GitHub Actions workflow updates `data/patches.json` every 3 days:

- Workflow file: `.github/workflows/update-patch-data.yml`
- Required repository secret: `PARSE_API_KEY`

## Disclaimer

Unofficial fan project. Not affiliated with Cloud Imperium Games.
