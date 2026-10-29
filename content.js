// Google Search Maps Button
// Restores the "Maps" tab on Google Search and makes result map previews
// open Google Maps when clicked.
(() => {
  "use strict";

  const TAB_ATTR = "data-gsmb-tab";
  const MAP_ATTR = "data-gsmb-map";
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

  function mapsUrl() {
    const query = getQuery();
    const url = new URL(query ? `/maps/search/${encodeURIComponent(query)}` : "/maps", location.origin);
    const hl = new URLSearchParams(location.search).get("hl");
    if (hl) url.searchParams.set("hl", hl);
    return url.href;
  }

  function openMaps(newTab) {
    if (newTab) window.open(mapsUrl(), "_blank", "noopener");
    else location.assign(mapsUrl());
  }

  // ---- Maps tab -----------------------------------------------------------

  function findTabTemplate() {
    // Prefer the Images tab: it is present on almost every results page and is
    // never the selected tab while browsing web results.
    const links = document.querySelectorAll('[role="listitem"] > a[href*="udm=2"], [role="listitem"] > a[href*="tbm=isch"]');
    for (const link of links) {
      const item = link.closest('[role="listitem"]');
      if (item && item.parentElement && item.parentElement.getAttribute("role") === "list") return item;
    }
    return null;
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

    const template = findTabTemplate();
    if (!template) return;
    const list = template.parentElement;
    if (hasNativeMapsTab(list)) return;

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

  // ---- Wiring --------------------------------------------------------------

  function update() {
    ensureMapsTab();
    markMapPreviews();
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  update();
  new MutationObserver(scheduleUpdate).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);
})();
