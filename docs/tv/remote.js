/**
 * REDVUE Android TV remote navigation v0.2
 *
 * No artificial 500ms row-switch delays:
 * - Up/Down follow visible shelves even while their TMDB catalog is loading.
 * - Current on-screen poster column is kept when changing shelves.
 * - Vertical scrolling only occurs when a shelf is partly out of view.
 * - Left/Right retain the existing catalog navigator and pagination.
 *
 * No effect on normal desktop browsing (the APK loads the page with ?tv=1).
 */
(function () {
  "use strict";
  if (!new URLSearchParams(location.search).has("tv")) return;

  const one = selector => document.querySelector(selector);
  const tiles = parent => Array.from(parent.querySelectorAll(".tile"));
  const rows = () => Array.from(document.querySelectorAll(".shelf:not(.hidden-by-filter)"));
  const isVisible = element => Boolean(element && element.isConnected &&
    element.getClientRects().length && !element.closest(".hidden"));
  const focusOnly = element => {
    if (!isVisible(element)) return false;
    element.focus({ preventScroll: true });
    return true;
  };
  const centerX = element => {
    const rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  };

  let desiredX = window.innerWidth * 0.25;
  let observer = null;
  let timeout = 0;
  let navigationId = 0;
  let scrollFrame = 0;
  let selectedPosition = null;
  const RETURN_KEY = "redvue-tv-return-v1";
  let restoring = false;

  function stopScroll() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }

  // Each D-pad press takes over the animation instead of stacking jumps.
  function glideTo(target) {
    stopScroll();
    const start = window.scrollY;
    const end = Math.max(0, target);
    const distance = end - start;
    if (Math.abs(distance) < 4) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, end);
      return;
    }
    const duration = Math.min(210, Math.max(125, Math.abs(distance) * 0.35));
    let began = 0;
    const step = now => {
      if (!began) began = now;
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, start + distance * eased);
      scrollFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    scrollFrame = requestAnimationFrame(step);
  }

  function remember(tile) {
    const shelf = tile && tile.closest(".shelf");
    if (!shelf) return;
    selectedPosition = {
      row: Number(shelf.dataset.row),
      id: tile.dataset.id || "",
      scrollY: window.scrollY,
      time: Date.now()
    };
  }

  function saveReturnPoint() {
    // Local-only browsing state, not a TMDB token or Stremio credential.
    if (!selectedPosition) return;
    try {
      localStorage.setItem(RETURN_KEY, JSON.stringify({
        ...selectedPosition, scrollY: window.scrollY, time: Date.now()
      }));
    } catch (error) { console.debug("REDVUE could not persist browsing position", error); }
  }

  function restoreReturnPoint() {
    if (restoring) return;
    let position = selectedPosition;
    try {
      const stored = JSON.parse(localStorage.getItem(RETURN_KEY) || "null");
      if (stored && Number.isInteger(stored.row) &&
          stored.time > Date.now() - 86400000) position = stored;
    } catch (error) { /* Storage may be disabled on some devices. */ }
    if (!position) return;
    const row = document.querySelector('.shelf[data-row="' + position.row + '"]');
    if (!row || row.classList.contains("hidden-by-filter")) return;
    restoring = true;
    cancelPending();
    if (window.REDVUE_TV_DATA?.loadRow)
      window.REDVUE_TV_DATA.loadRow(position.row);
    const rail = row.querySelector(".rail");
    const finish = () => {
      let tile = Array.from(rail.querySelectorAll(".tile"))
        .find(t => t.dataset.id === position.id);
      if (!tile) tile = rail.querySelector(".tile");
      if (!tile) return false;
      // Restore the selected poster, not the top of the homepage.
      focusTile(tile, row);
      restoring = false;
      return true;
    };
    if (finish()) return;
    const observer = new MutationObserver(() => {
      if (finish()) observer.disconnect();
    });
    observer.observe(rail, { childList: true });
    setTimeout(() => { observer.disconnect(); restoring = false; }, 8000);
  }

  function cancelPending() {
    navigationId += 1;
    if (observer) observer.disconnect();
    observer = null;
    if (timeout) clearTimeout(timeout);
    timeout = 0;
  }

  function showRow(row) {
    const rect = row.getBoundingClientRect();
    const topLimit = Math.max(104, window.innerHeight * 0.11);
    const bottomLimit = window.innerHeight - 30;
    // Keep the title and posters visible without recentering every shelf.
    let adjustment = 0;
    if (rect.top < topLimit) adjustment = rect.top - topLimit;
    else if (rect.bottom > bottomLimit) adjustment = rect.bottom - bottomLimit;
    if (Math.abs(adjustment) > 3) glideTo(window.scrollY + adjustment);
  }

  function revealHorizontally(tile) {
    const rail = tile.closest(".rail");
    if (!rail) return;
    const bounds = rail.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    const margin = 28;
    if (rect.left < bounds.left + margin)
      rail.scrollLeft += rect.left - bounds.left - margin;
    else if (rect.right > bounds.right - margin)
      rail.scrollLeft += rect.right - bounds.right + margin;
  }

  function focusTile(tile, row) {
    if (!focusOnly(tile)) return false;
    revealHorizontally(tile);
    showRow(row);
    desiredX = centerX(tile);
    remember(tile);
    return true;
  }

  function closestColumn(row, x) {
    const rail = row.querySelector(".rail");
    if (!rail) return null;
    const bounds = rail.getBoundingClientRect();
    const items = tiles(rail).filter(isVisible);
    if (!items.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const item of items) {
      const midpoint = centerX(item);
      // Prefer posters inside the visible horizontal strip, not offscreen.
      const distance = Math.abs(midpoint - x) +
        (midpoint < bounds.left || midpoint > bounds.right ? 10000 : 0);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  function openRow(row, x) {
    cancelPending();
    const request = navigationId;
    const index = Number(row.dataset.row);
    // Directly start loading: the next shelf may be outside the lazy-load area.
    if (window.REDVUE_TV_DATA && window.REDVUE_TV_DATA.loadRow) {
      window.REDVUE_TV_DATA.loadRow(index);
      // Load only the next visible shelf ahead to reduce waiting on navigation.
      const sibling = rows()[rows().indexOf(row) + 1];
      if (sibling) window.REDVUE_TV_DATA.loadRow(Number(sibling.dataset.row));
    }

    const tryFocus = () => {
      if (request !== navigationId) return false;
      const tile = closestColumn(row, x);
      return tile ? focusTile(tile, row) : false;
    };

    if (tryFocus()) return;

    // Show the new row's loading skeleton and give focus to its heading.
    // Subsequent Up/Down inputs can now continue to adjacent rows.
    const heading = row.querySelector("h2");
    if (heading) {
      heading.tabIndex = -1;
      focusOnly(heading);
    }
    showRow(row);
    const rail = row.querySelector(".rail");
    if (!rail) return;
    observer = new MutationObserver(() => {
      if (tryFocus()) cancelPending();
    });
    observer.observe(rail, { childList: true });
    timeout = setTimeout(() => {
      if (request === navigationId) cancelPending();
    }, 10000);
  }

  function firstRow() {
    const row = rows()[0];
    if (row) openRow(row, window.innerWidth * 0.09);
  }

  function currentDialog() {
    // Always target the topmost popup. If another overlay is temporarily
    // open during the transition, never send keys to the search behind it.
    const details = one("#details-overlay");
    if (details && !details.classList.contains("hidden")) return details;
    const search = one("#search-overlay");
    if (search && !search.classList.contains("hidden")) return search;
    return null;
  }

  function searchKey(name) {
    const dialog = one("#search-overlay");
    const input = one("#search-input");
    const close = dialog.querySelector("[data-close]");
    const results = tiles(dialog);
    const active = document.activeElement;
    if (name === "Enter") {
      if (active && typeof active.click === "function") active.click();
      return;
    }
    if (active === input) {
      if (name === "ArrowDown" && results.length) focusOnly(results[0]);
      else if (name === "ArrowUp") focusOnly(close);
      return;
    }
    if (active === close) {
      if (name === "ArrowDown") focusOnly(input);
      return;
    }
    if (!active || !active.classList.contains("tile")) {
      focusOnly(input);
      return;
    }
    const position = results.indexOf(active);
    if (position < 0) return;
    const resultBox = dialog.querySelector(".results");
    const itemWidth = active.getBoundingClientRect().width + 14;
    const columns = Math.max(1, Math.floor((resultBox.clientWidth + 14) / itemWidth));
    if (name === "ArrowUp" && position < columns) {
      focusOnly(input);
      return;
    }
    const delta = name === "ArrowLeft" ? -1 : name === "ArrowRight" ? 1 :
      name === "ArrowDown" ? columns : -columns;
    const next = results[Math.max(0, Math.min(results.length - 1, position + delta))];
    if (focusOnly(next)) next.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function detailKey(name) {
    const close = one(".detail-close");
    const launch = one("#detail-launch");
    const active = document.activeElement;
    if (name === "Enter") {
      if (active && typeof active.click === "function") active.click();
    } else if (name === "ArrowDown" || name === "ArrowRight") {
      focusOnly(launch && launch.getAttribute("href") ? launch : close);
    } else focusOnly(close);
  }

  function topControls() {
    // Navigation, hero and search remain reachable from a TV remote.
    return [
      ...document.querySelectorAll(".nav-btn"),
      one("#search-open"),
      one("#hero-detail"),
      one("#hero-explore")
    ].filter(isVisible);
  }

  function key(name) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(name))
      return "handled";

    const dialog = currentDialog();
    if (dialog) {
      if (dialog.id === "details-overlay") detailKey(name);
      else searchKey(name);
      return "handled";
    }

    const active = document.activeElement;
    if (name === "Enter") {
      cancelPending();
      if (active && active !== document.body && typeof active.click === "function")
        active.click();
      else focusOnly(one("#hero-detail"));
      return "handled";
    }

    const currentRow = active && active.closest && active.closest(".shelf");
    if (currentRow && !currentRow.classList.contains("hidden-by-filter")) {
      if (active.classList.contains("tile") &&
          (name === "ArrowLeft" || name === "ArrowRight")) {
        cancelPending();
        // Preserve the working horizontal navigation and lazy pagination.
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: name, bubbles: true, cancelable: true
        }));
        if (document.activeElement && document.activeElement.classList.contains("tile")) {
          desiredX = centerX(document.activeElement);
          remember(document.activeElement);
        }
        return "handled";
      }
      if (name === "ArrowLeft" || name === "ArrowRight") return "handled";
      const shelves = rows();
      const nextIndex = shelves.indexOf(currentRow) +
        (name === "ArrowDown" ? 1 : -1);
      if (active.classList.contains("tile")) desiredX = centerX(active);
      if (nextIndex < 0) {
        cancelPending();
        focusOnly(one("#hero-detail"));
        glideTo(0);
      } else if (nextIndex < shelves.length) {
        openRow(shelves[nextIndex], desiredX);
      }
      return "handled";
    }

    const controls = topControls();
    if (name === "ArrowDown") {
      firstRow();
      return "handled";
    }
    if (name === "ArrowUp") {
      focusOnly(one(".nav-btn.active") || controls[0]);
      glideTo(0);
      return "handled";
    }
    const current = controls.indexOf(active);
    const index = current === -1 ? 0 : current;
    focusOnly(controls[Math.max(0, Math.min(controls.length - 1,
      index + (name === "ArrowRight" ? 1 : -1)))]);
    return "handled";
  }

  function back() {
    cancelPending();
    const dialog = currentDialog();
    if (dialog) {
      const close = dialog.querySelector("[data-close]");
      if (close) close.click();
      return "handled";
    }
    const active = document.activeElement;
    if (active && active.closest && active.closest(".shelf")) {
      focusOnly(one("#hero-detail"));
      glideTo(0);
      return "handled";
    }
    return "exit";
  }

  function initialise() {
    document.body.classList.add("tv-mode");
    document.documentElement.style.scrollBehavior = "auto";
    if (!document.activeElement || document.activeElement === document.body)
      focusOnly(one("#hero-detail"));
    restoreReturnPoint();
  }

  function suspend() {
    saveReturnPoint();
    stopScroll();
  }

  function resume() {
    const dialog = currentDialog();
    // An external playback session was launched. Return to the catalogue.
    if (dialog?.id === "details-overlay") {
      const close = dialog.querySelector("[data-close]");
      if (close) close.click();
    }
    restoreReturnPoint();
  }

  window.REDVUE_TV_REMOTE = {
    initialise, key, back, saveReturnPoint, suspend, resume
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
