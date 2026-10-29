# Google Search Maps Button

A small Chrome extension that brings back what Google removed from Search in the EU:

- **Maps tab** — a "Maps" tab is added right after "All" in the Google Search tab bar. It opens your current search in Google Maps.
- **Clickable map previews** — clicking the map shown in search results (e.g. the "Places" map) opens the search in Google Maps. Cmd/Ctrl/Shift-click or middle-click opens it in a new tab. Dragging the map to pan it, and the map's own buttons (expand, pins), still work as before.

No permissions beyond running on Google Search pages, no background script, no data collected or stored.

## Install

1. Download this repository (green **Code** button → **Download ZIP**, then unzip) or `git clone` it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder containing `manifest.json`.

Works in any Chromium browser that supports Manifest V3: Chrome, Edge (`edge://extensions`), Brave (`brave://extensions`), Opera and Vivaldi. In Opera, also enable **Allow access to search page results** for the extension.

To update, pull/download the latest version and click the reload icon on the extension's card in `chrome://extensions`.

## How it works

`content.js` runs on `/search` pages of every Google domain listed at <https://www.google.com/supported_domains>.

- The Maps tab is a copy of Google's own Images tab with its tracking/script attributes removed, so it matches Google's styling. If Google already shows a Maps tab (outside the EU), nothing is added.
- Map previews are found by their `maps/vt` / `staticmap` image source. The extension marks the map's box and handles clicks on it, so it keeps working after Google swaps the static image for the interactive map.
- A `MutationObserver` re-applies both when Google re-renders the page.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 definition and the Google domains the script runs on |
| `content.js` | Adds the Maps tab and makes map previews clickable |
| `styles.css` | Pointer cursor over clickable maps |
| `icons/` | Extension icons |

## License

GPL-3.0, see [LICENSE](LICENSE).
