# Google Search Maps Button

A small Chrome extension that brings back what Google removed from Search in the EU:

- **Maps tab** — a "Maps" tab is added right after "All" in the Google Search tab bar. It opens your current search in Google Maps.
- **Clickable map previews** — clicking the map shown in search results (e.g. the "Places" map) opens the search in Google Maps. Cmd/Ctrl/Shift-click or middle-click opens it in a new tab. Dragging the map to pan it, and the map's own buttons (expand, pins), still work as before.
- **Map beside the results** — for searches about a place, when Google shows no map of its own, an interactive Google Maps panel appears in the right-hand column:
  - for a place with a Google info panel (address shown), the map sits at the top of that panel, pinned to the place;
  - otherwise the extension asks Google Maps whether the search finds a place whose name and address contain the search words (e.g. "downlow chicken" → DownLow Chicken Shack), and shows the map in the empty right column only if it does.

  Searches that aren't about places ("python sort list", "how to boil eggs", people, films, …) get no map, and neither do non-"All" tabs or pages where Google already shows a map. **Hide map** / **Show map** under the panel toggles it, and the choice is remembered.

No background script and no data collected. The only permission is `storage`, used to remember whether the map panel is hidden.

## Install

1. Download this repository (green **Code** button → **Download ZIP**, then unzip) or `git clone` it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder containing `manifest.json`.

Works in any Chromium browser that supports Manifest V3: Chrome, Edge (`edge://extensions`), Brave (`brave://extensions`), Opera and Vivaldi. In Opera, also enable **Allow access to search page results** for the extension.

## Update

The manifest carries a fixed `key`, so the extension always has the same ID (`icenfjlibihobocclccdijbolcnfplkp`) whichever folder it is loaded from. A new version therefore replaces the installed one instead of appearing as a second extension, and settings (such as a hidden map) are kept.

- **Same folder** (e.g. `git pull`): click the reload icon on the extension's card in `chrome://extensions`.
- **New download/unzip:** click **Load unpacked** and select the new folder. It takes the place of the old one; afterwards the old folder can be deleted.

## How it works

`content.js` runs on `/search` pages of every Google domain listed at <https://www.google.com/supported_domains>.

- The Maps tab is a copy of Google's own Images tab with its tracking/script attributes removed, so it matches Google's styling. If Google already shows a Maps tab (outside the EU), nothing is added.
- Map previews are found by their `maps/vt` / `staticmap` image source. The extension marks the map's box and handles clicks on it, so it keeps working after Google swaps the static image for the interactive map.
- The place check is the same request Google Maps itself makes for a search (`/search?tbm=map`), sent to the Google domain you're on without cookies, so it isn't tied to your account. It runs once per search, only when the right-hand column is empty.
- The map panel is Google Maps' keyless embed (`google.com/maps?q=…&output=embed`) in an iframe, placed in the grid slot Google uses for its own right-hand column.
- A `MutationObserver` re-applies everything when Google re-renders the page.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 definition and the Google domains the script runs on |
| `content.js` | Adds the Maps tab, makes map previews clickable, and adds the map panel |
| `styles.css` | Pointer cursor over clickable maps and the map panel's styling |
| `icons/` | Extension icons |

## License

GPL-3.0, see [LICENSE](LICENSE).
