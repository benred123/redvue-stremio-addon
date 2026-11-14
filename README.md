# REDVUE — Stremio catalog add-on + TV-first browser

**Everything worth watching.**

This repository contains two distinct projects:

- **Stremio catalog add-on** (`docs/manifest.json`): five hand-picked collections, with Stremio-controlled interface.
- **REDVUE TV browser** (`docs/tv/`): independently designed Netflix-style homepage, with 30 horizontally scrollable TMDB rows when configured (18 fallback Cinemeta rows), live catalog discovery, search, details, keyboard/TV-remote arrow navigation, and a Stremio deep-link handoff.

## TMDB-powered catalog (new)

The TV homepage now supports **30 live TMDB shelves**, cinematic backdrops, full-text movie/TV search, paginated browsing and IMDb-ID resolution for Stremio handoff. Cinemeta remains the fallback until the secure TMDB gateway is configured.

**Setup**

1. Register at https://www.themoviedb.org and request the **API Read Access Token** under account settings > API. Do not share the token in chat, GitHub or browser code.
2. Create a Cloudflare Worker at https://dash.cloudflare.com > Workers & Pages > Create application > Create Worker. Replace its default JavaScript with `worker/tmdb-worker.js` from this repo and deploy.
3. In the Worker's **Settings > Variables and Secrets**, add a variable named `TMDB_READ_TOKEN`, choose **Secret**, and paste your TMDB **API Read Access Token** as its value. Deploy the changes.
4. Test `https://YOUR-WORKER.workers.dev/health` (should show `"configured":true`) and `https://YOUR-WORKER.workers.dev/catalog/trending-movies?page=1` (should show results).
5. Edit `docs/tv/config.js`: replace the empty string in `window.REDVUE_TMDB_API = "";` with your **public Worker URL only**, e.g. `https://redvue-tmdb.example.workers.dev`. Commit to `main` (GitHub Pages will publish the change).
6. Reload https://benred123.github.io/redvue-stremio-addon/tv/. The footer will say **Live catalogue: TMDB**.

The public Worker URL is safe to commit; the API token never goes into GitHub Pages. Public Workers can still consume TMDB request quotas, so this prototype is for private/non-commercial development. TMDB attribution is shown in the TV app's footer, according to TMDB's API rules.

## Try the new TV interface

Visit **https://benred123.github.io/redvue-stremio-addon/tv/** using a computer or TV browser. On a keyboard use arrow keys to move between titles and rows, Enter to open details, Escape to close. On a Fire Stick you can try a TV browser such as Silk. Native remote and app launching must be tested on your actual device; not all TV browsers support the same navigation or external application links.

**Important:** This web interface is not a Stremio add-on theme, and will not replace Stremio's native home screen. Playback availability still depends on Stremio and your installed sources. The app does not host, download or supply video streams.

The TV homepage uses the public **Cinemeta** catalog service for discovery data (including genre, ratings and pagination), so rows can show many more titles than our original 50. Cinemeta availability and cross-origin browser access are external dependencies; if a catalog is unavailable, the UI offers retry.

## Add-on installation

1. Publish the `docs/` directory with GitHub Pages in **Settings > Pages > Deploy from a branch > main > /docs**.
2. Install `https://benred123.github.io/redvue-stremio-addon/manifest.json` in Stremio using your usual account.
3. Open Stremio on the TV with the same account to access its native catalog view.

## Edit the add-on collections

Change `catalogs.js`, then with Node.js installed run `node build.js`. Commit regenerated `docs/` contents.

## TV browser code

- `docs/tv/index.html`: accessible main UI and dialogs.
- `docs/tv/styles.css`: Netflix-inspired REDVUE styling.
- `docs/tv/app.js`: API requests, remote navigation, pagination, search, details and Stremio handoff.
- `docs/tv/site.webmanifest`: installable web-app metadata for supporting browsers.

> No API secrets, accounts, streams, DRM bypass, or server are required for this catalog browsing prototype. An actual native Android TV application is a separate future build and can be based on this UI.

## References

- [Stremio addon SDK](https://stremio.github.io/stremio-addon-sdk/)
- [Stremio deep links](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deep-links.md)
