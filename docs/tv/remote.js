/**
 * REDVUE TV remote controller.
 * Loaded only when the app URL includes ?tv=1; harmless in a desktop browser.
 * The Android activity sends directional keys here instead of relying on
 * Amazon Silk's cursor navigation.
 */
(function () {
  "use strict";
  if (!new URLSearchParams(location.search).has("tv")) return;

  const one = (selector) => document.querySelector(selector);
  const shown = (element) => Boolean(element && element.isConnected &&
    element.getClientRects().length && !element.closest(".hidden"));
  const focus = (element) => {
    if (!shown(element)) return false;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    return true;
  };
  const visibleRows = () => Array.from(document.querySelectorAll(".shelf:not(.hidden-by-filter)"));
  const cards = (parent) => Array.from(parent.querySelectorAll(".tile"));

  // Catalog pages load asynchronously. Wait for the first actual poster
  // instead of focusing the skeleton placeholders.
  function focusFirstRow() {
    const row = visibleRows()[0];
    if (!row) return;
    const first = cards(row)[0];
    if (first) { focus(first); return; }
    const rail = row.querySelector(".rail");
    if (!rail) return;
    const observer = new MutationObserver(() => {
      const next = cards(rail)[0];
      if (next) { observer.disconnect(); focus(next); }
    });
    observer.observe(rail, { childList: true });
    setTimeout(() => observer.disconnect(), 8000);
  }

  function isDialogOpen() {
    return one(".overlay:not(.hidden)");
  }
  function moveInSearch(key) {
    const overlay = one("#search-overlay");
    const results = cards(overlay);
    const current = document.activeElement;
    if (key === "Enter") {
      if (current && typeof current.click === "function") current.click();
      return;
    }
    const input = one("#search-input");
    if (current === input) {
      if (key === "ArrowDown" && results.length) focus(results[0]);
      else if (key === "ArrowUp") focus(overlay.querySelector("[data-close]"));
      return;
    }
    if (current.matches(".close") && key === "ArrowDown") { focus(input); return; }
    if (!current.classList.contains("tile")) { focus(input); return; }
    const index = results.indexOf(current);
    if (index < 0) { focus(input); return; }
    if (key === "ArrowUp" && index < 6) { focus(input); return; }
    const columnCount = Math.max(1, Math.round(overlay.querySelector(".results").clientWidth / (current.getBoundingClientRect().width + 14)));
    const delta = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowDown" ? columnCount : -columnCount;
    focus(results[Math.max(0, Math.min(results.length - 1, index + delta))]);
  }
  function moveInDetails(key) {
    const close = one(".detail-close");
    const launch = one("#detail-launch");
    if (key === "Enter") {
      const active = document.activeElement;
      if (active && typeof active.click === "function") active.click();
      return;
    }
    if (key === "ArrowDown" || key === "ArrowRight")
      focus(launch && launch.getAttribute("href") ? launch : close);
    else focus(close);
  }
  function key(name) {
    const dialog = isDialogOpen();
    if (dialog) {
      if (dialog.id === "details-overlay") moveInDetails(name);
      else moveInSearch(name);
      return "handled";
    }
    const active = document.activeElement;
    if (name === "Enter") {
      if (active && typeof active.click === "function" && active !== document.body)
        active.click();
      else focus(one("#hero-detail"));
      return "handled";
    }
    // Existing REDVUE app.js handles focus + scrolling between rows.
    if (active && active.classList.contains("tile") && active.closest(".shelf")) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
      return "handled";
    }
    const top = [one(".nav-btn.active"), one("#hero-detail"), one("#hero-explore"), one("#search-open")].filter(shown);
    let index = top.indexOf(active);
    if (name === "ArrowDown") { focusFirstRow(); return "handled"; }
    if (name === "ArrowUp") { focus(top[0]); return "handled"; }
    if (index < 0) index = 1;
    if (name === "ArrowLeft") focus(top[Math.max(0, index - 1)]);
    if (name === "ArrowRight") focus(top[Math.min(top.length - 1, index + 1)]);
    return "handled";
  }
  function back() {
    const dialog = isDialogOpen();
    if (dialog) {
      const close = dialog.querySelector("[data-close]");
      if (close) close.click();
      return "handled";
    }
    const active = document.activeElement;
    if (active && active.closest(".shelf")) {
      focus(one("#hero-detail"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return "handled";
    }
    return "exit";
  }
  function initialise() {
    document.body.classList.add("tv-mode");
    if (!shown(document.activeElement) || document.activeElement === document.body)
      focus(one("#hero-detail"));
  }
  window.REDVUE_TV_REMOTE = { initialise, key, back };
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
})();
