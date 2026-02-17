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

## Project Structure

- `index.html` - App structure and content sections
- `styles.css` - Theme, layout, and responsive styling
- `main.js` - Patch data model and UI rendering logic

## Run Locally

Open `index.html` directly in your browser, or serve with a local HTTP server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Updating Patch Notes

Edit `main.js`:

- Update version/date with `setVersion(version, date)`
- Update counters with `setStats({ ... })`
- Add sections with `addCategory(name, items)`

Example:

```js
setVersion("4.1.0", "March 2026");
setStats({ features: 5, improvements: 12, fixes: 41, ships: 3 });
addCategory("Gameplay", [
  "Improved mission tracking in mobiGlas",
  "Adjusted EVA movement responsiveness"
]);
```

## Disclaimer

Unofficial fan project. Not affiliated with Cloud Imperium Games.
