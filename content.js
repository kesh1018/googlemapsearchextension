// Google Search Maps Button
// Restores the "Maps" tab on Google Search, makes result map previews open
// Google Maps when clicked, and shows a map in the right-hand column.
(() => {
  "use strict";

  const TAB_ATTR = "data-gsmb-tab";
  const MAP_ATTR = "data-gsmb-map";
  const PANEL_ID = "gsmb-panel";
  const HIDDEN_KEY = "mapPanelHidden";
  const MAP_IMG_SELECTOR = [
    'img[src*="/maps/vt"]',
    'img[src*="/maps/api/staticmap"]',
    'img[data-src*="/maps/vt"]',
    'img[data-src*="/maps/api/staticmap"]',
  ].join(",");
  // Attributes Google's own scripts hook into; stripped from the cloned tab so
  // clicks on it aren't intercepted.
  const GOOGLE_ATTRS = ["jsname", "jsaction", "jscontroller", "jsmodel", "data-ved", "data-hveid", "ping", "id", "aria-current", "aria-disabled", "selected"];
  const DRAG_TOLERANCE_PX = 6;

  function getQuery() {
    const fromUrl = new URLSearchParams(location.search).get("q");
    if (fromUrl) return fromUrl.trim();
    const input = document.querySelector('textarea[name="q"], input[name="q"]');
    return input ? input.value.trim() : "";
  }

  function mapsUrl(query = getQuery()) {
    const url = new URL(query ? `/maps/search/${encodeURIComponent(query)}` : "/maps", location.origin);
    const hl = new URLSearchParams(location.search).get("hl");
    if (hl) url.searchParams.set("hl", hl);
    return url.href;
  }

  // Keyless Maps embed; www.google.com serves it for every country domain.
  function embedUrl(query) {
    const url = new URL("https://www.google.com/maps");
    url.searchParams.set("q", query);
    url.searchParams.set("output", "embed");
    const hl = new URLSearchParams(location.search).get("hl");
    if (hl) url.searchParams.set("hl", hl);
    return url.href;
  }

  function openMaps(newTab) {
    if (newTab) window.open(mapsUrl(), "_blank", "noopener");
    else location.assign(mapsUrl());
  }

  // ---- Maps tab -----------------------------------------------------------

  const VERTICAL_TAB = ':scope > [role="listitem"] > a[href*="udm="], :scope > [role="listitem"] > a[href*="tbm="]';

  // The tab bar is the list holding both "All" and links to other verticals
  // (Images, News, ...). Suggestion chips on the Images tab are lists too, but
  // every chip links to an image search, so none of them counts as "All".
  function findTabBar() {
    for (const list of document.querySelectorAll('[role="list"]')) {
      if (findAllItem(list) && list.querySelector(VERTICAL_TAB)) return list;
    }
    return null;
  }

  // Copy an unselected vertical tab (the selected one has no href) so the clone
  // gets Google's normal tab styling: Images if possible, never AI Mode
  // (udm=50), which is styled differently.
  function findTabTemplate(list) {
    const tabs = [...list.querySelectorAll(VERTICAL_TAB)].map((link) => {
      const params = new URL(link.href).searchParams;
      return { link, udm: params.get("udm"), tbm: params.get("tbm") };
    });
    const pick = tabs.find((t) => t.udm === "2" || t.tbm === "isch") || tabs.find((t) => t.udm !== "50");
    return pick ? pick.link.closest('[role="listitem"]') : null;
  }

  function hasNativeMapsTab(list) {
    return [...list.querySelectorAll('[role="listitem"] a[href]')].some((a) => {
      if (a.closest(`[${TAB_ATTR}]`)) return false;
      const href = a.getAttribute("href");
      return /(^|\/\/[^/]*)\/maps(\/|\?|$)|maps\.google\./.test(href);
    });
  }

  function setLabel(root, text) {
    // Replace the deepest text node so the tab keeps Google's styling wrappers.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const node = walker.nextNode();
    if (node) node.nodeValue = text;
    else root.textContent = text;
  }

  function buildTab(template) {
    const tab = template.cloneNode(true);
    for (const el of [tab, ...tab.querySelectorAll("*")]) {
      for (const attr of GOOGLE_ATTRS) el.removeAttribute(attr);
    }
    tab.setAttribute(TAB_ATTR, "");
    const link = tab.querySelector("a");
    link.href = mapsUrl();
    link.removeAttribute("role");
    link.removeAttribute("tabindex");
    setLabel(link, "Maps");
    return tab;
  }

  function ensureMapsTab() {
    const existing = document.querySelector(`[${TAB_ATTR}]`);
    if (existing) {
      const link = existing.querySelector("a");
      const href = mapsUrl();
      if (link && link.href !== href) link.href = href;
      return;
    }

    const list = findTabBar();
    if (!list || hasNativeMapsTab(list)) return;
    const template = findTabTemplate(list);
    if (!template) return;

    // Place it straight after "All", where Google used to show it.
    const all = findAllItem(list);
    list.insertBefore(buildTab(template), all ? all.nextSibling : template);
  }

  // "All" links to plain web results: a /search URL with no udm/tbm vertical.
  // When it is the current tab its link has no href, so check the page URL.
  function isAllResults(url) {
    return url.pathname === "/search" && !url.searchParams.get("udm") && !url.searchParams.get("tbm");
  }

  function findAllItem(list) {
    for (const item of list.querySelectorAll(':scope > [role="listitem"]')) {
      const link = item.querySelector("a");
      if (!link) continue;
      const href = link.getAttribute("href");
      if (isAllResults(href ? new URL(href, location.href) : new URL(location.href))) return item;
    }
    return null;
  }

  // ---- Clickable map previews ---------------------------------------------

  // The visible map box: the outermost ancestor of the preview image that still
  // has the image's footprint. Google later swaps the static image for an
  // interactive map inside that same box, so the click handler keeps working.
  function mapBoxFor(img) {
    const width = img.offsetWidth;
    const height = img.offsetHeight;
    if (!width || !height) return null;
    let box = img;
    while (box.parentElement && box.parentElement !== document.body) {
      const parent = box.parentElement;
      if (parent.offsetWidth > width + 10 || parent.offsetHeight > height + 10) break;
      box = parent;
    }
    return box;
  }

  function markMapPreviews() {
    for (const img of document.querySelectorAll(MAP_IMG_SELECTOR)) {
      if (img.closest(`[${MAP_ATTR}]`) || img.closest("a[href]")) continue;
      const box = mapBoxFor(img);
      if (!box || box.closest("a[href]")) continue;
      box.setAttribute(MAP_ATTR, "");
      if (!box.title) box.title = "Open in Google Maps";
    }
  }

  let pointerStart = null;

  document.addEventListener(
    "pointerdown",
    (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    },
    true
  );

  function handleMapClick(event) {
    const box = event.target instanceof Element ? event.target.closest(`[${MAP_ATTR}]`) : null;
    if (!box) return;
    // Leave the map's own controls (expand, zoom, pins) and links alone.
    const control = event.target.closest('a[href], button, [role="button"], [role="link"]');
    if (control && box.contains(control)) return;
    // A drag on the interactive map is panning, not a click.
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > DRAG_TOLERANCE_PX) return;
    if (event.button > 1) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openMaps(event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey);
  }

  document.addEventListener("click", handleMapClick, true);
  document.addEventListener("auxclick", handleMapClick, true);

  // ---- Right-hand map panel -----------------------------------------------

  let panelHidden = false;
  // Wait for the saved hidden/shown choice so the map doesn't flash in.
  let panelStateLoaded = false;

  // A knowledge panel about a place has an address or a Maps place link; one
  // about a person, film, etc. has neither and gets no map.
  function placeFromKnowledgePanel(rhs) {
    const placeLink = rhs.querySelector('a[href*="/maps/place"]');
    const addressEl = rhs.querySelector('[data-attrid*="address"]');
    if (!placeLink && !addressEl) return null;
    const title = rhs.querySelector('[data-attrid="title"]');
    const name = title ? title.textContent.trim() : getQuery();
    // Drop the localized "Address:" label in front of the value.
    const address = addressEl ? addressEl.textContent.trim().replace(/^[^:\d]{1,25}:\s*/, "") : "";
    const query = [name, address].filter(Boolean).join(", ");
    return { query, href: placeLink ? placeLink.href : mapsUrl(query) };
  }

  // Without a knowledge panel the results page gives no hint that a search is
  // about a place, so ask Google Maps: the search counts as a place when Maps
  // finds a place whose name and address contain the search words.
  const FILLER_WORDS = new Set(["near", "me", "in", "at", "the", "a", "an", "of", "and", "best", "top", "open", "now", "nearby", "around", "closest", "nearest"]);
  const placeLookups = new Map(); // query -> "pending" | true | false

  function words(text) {
    return text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "") // accents: "café" matches "cafe"
      .replace(/['’]/g, "") // "mcdonalds" matches "McDonald's"
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  }

  // Place entries in a Maps search reply have the name at [11], coordinates
  // [null, null, lat, lng] at [9] and the address at [39].
  function collectPlaces(node, out) {
    if (!Array.isArray(node)) return;
    const coords = node[9];
    if (typeof node[11] === "string" && Array.isArray(coords) && coords.length === 4 && typeof coords[2] === "number") {
      out.push(`${node[11]} ${typeof node[39] === "string" ? node[39] : ""}`);
    }
    for (const child of node) collectPlaces(child, out);
  }

  function matchesPlace(query, places) {
    const searchWords = words(query).filter((w) => w.length > 1 && !FILLER_WORDS.has(w));
    if (!searchWords.length) return places.length > 0;
    // Longer searches may carry one word the place doesn't ("dl chicken shack").
    const allowedMisses = searchWords.length >= 3 ? 1 : 0;
    return places.some((place) => {
      const placeWords = new Set(words(place));
      return searchWords.filter((w) => !placeWords.has(w)).length <= allowedMisses;
    });
  }

  async function lookUpPlace(query) {
    // The request Google Maps makes for a search, trimmed to the parameters
    // that still return place names and addresses. Sent without cookies so it
    // isn't tied to the signed-in account.
    const url = new URL("/search", location.origin);
    url.searchParams.set("tbm", "map");
    url.searchParams.set("q", query);
    url.searchParams.set("pb", `!1s${query.replace(/!/g, " ")}!7i20!10b1`);
    const hl = new URLSearchParams(location.search).get("hl");
    if (hl) url.searchParams.set("hl", hl);
    try {
      const response = await fetch(url, { credentials: "omit" });
      const text = await response.text();
      // The reply starts with an anti-JSON-hijacking line: )]}'
      const places = [];
      collectPlaces(JSON.parse(text.slice(text.indexOf("\n") + 1)), places);
      return matchesPlace(query, places);
    } catch {
      return false;
    }
  }

  function isPlaceSearch(query) {
    if (!placeLookups.has(query)) {
      placeLookups.set(query, "pending");
      lookUpPlace(query).then((isPlace) => {
        placeLookups.set(query, isPlace);
        scheduleUpdate();
      });
    }
    return placeLookups.get(query) === true;
  }

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <iframe class="gsmb-frame" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      <div class="gsmb-actions">
        <a class="gsmb-open">Open in Google Maps</a>
        <button class="gsmb-toggle" type="button"></button>
      </div>`;
    panel.querySelector(".gsmb-toggle").addEventListener("click", () => {
      panelHidden = !panelHidden;
      chrome.storage.local.set({ [HIDDEN_KEY]: panelHidden });
      renderPanel(panel);
    });
    return panel;
  }

  function renderPanel(panel) {
    const frame = panel.querySelector(".gsmb-frame");
    panel.classList.toggle("gsmb-hidden", panelHidden);
    // Only touch the label when it changes: rewriting it is a DOM mutation,
    // which would re-trigger the observer forever.
    const toggle = panel.querySelector(".gsmb-toggle");
    const label = panelHidden ? "Show map" : "Hide map";
    if (toggle.textContent !== label) toggle.textContent = label;
    panel.querySelector(".gsmb-open").href = panel.dataset.href;
    // Only load the map while it is visible.
    const src = panelHidden ? "" : embedUrl(panel.dataset.query);
    if (frame.getAttribute("src") !== src) {
      if (src) frame.src = src;
      else frame.removeAttribute("src");
    }
  }

  function ensureMapPanel() {
    if (!panelStateLoaded) return;
    let panel = document.getElementById(PANEL_ID);
    const results = document.getElementById("center_col");
    const rhs = document.getElementById("rhs");
    // Google already shows (and we made clickable) a map; don't add a second.
    const pageHasMap = document.querySelector(`[${MAP_ATTR}]`);

    let place = null;
    if (results && !pageHasMap && isAllResults(new URL(location.href))) {
      if (rhs) place = placeFromKnowledgePanel(rhs);
      else if (getQuery() && isPlaceSearch(getQuery())) place = { query: getQuery(), href: mapsUrl() };
    }

    if (!place) {
      if (panel) panel.remove();
      return;
    }

    if (!panel) panel = buildPanel();
    const standalone = !rhs;
    if (standalone && panel.previousElementSibling !== results) results.after(panel);
    else if (!standalone && panel !== rhs.firstElementChild) rhs.prepend(panel);
    panel.classList.toggle("gsmb-standalone", standalone);

    panel.dataset.query = place.query;
    panel.dataset.href = place.href;
    renderPanel(panel);
  }

  // ---- Wiring --------------------------------------------------------------

  function update() {
    ensureMapsTab();
    markMapPreviews();
    ensureMapPanel();
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      update();
    }, 50);
  }

  update();
  chrome.storage.local.get(HIDDEN_KEY).then((stored) => {
    panelHidden = Boolean(stored[HIDDEN_KEY]);
    panelStateLoaded = true;
    scheduleUpdate();
  });
  new MutationObserver(scheduleUpdate).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);
})();
